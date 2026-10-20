# frozen_string_literal: true

require "net/http"
require "json"

module Decidim
  module KpiManager
    # Fetches the current user's KPIs and measures from the URBREATH KPI
    # Manager API, using their Keycloak access token (the same one used to
    # sign in to Decidim) as a bearer token.
    #
    # API reference (from the "KPI MANAGER - URBREATH" Postman collection):
    #   GET  {base_url}/measures
    #   GET  {base_url}/measures/:id
    #   GET  {base_url}/kpi
    #   GET  {base_url}/kpi/:id
    #   GET  {base_url}/historical-data/query/all?bucket=&measurement=&kpimEngineRequest=false
    #
    # When no base URL is configured (e.g. in local development), or the API
    # is unreachable, it falls back to a small demo dataset so the rest of the
    # flow (listing, embedding, rendering) can still be exercised.
    class ApiClient
      class RequestError < StandardError; end

      def initialize(access_token:, base_url: Decidim::KpiManager.api_base_url)
        @access_token = access_token
        @base_url = base_url
      end

      def kpis(query: nil)
        items = fetch("/kpi")
        items ? normalize_collection(items, "kpi", query) : demo_kpis(query)
      end

      def measures(query: nil)
        items = fetch("/measures")
        items ? normalize_collection(items, "measure", query) : demo_measures(query)
      end

      def find_kpi(id)
        item = unwrap(fetch("/kpi/#{id}"))
        item ? normalize(item, "kpi") : demo_kpis(nil).find { |kpi| kpi["id"].to_s == id.to_s }
      end

      def find_measure(id)
        item = unwrap(fetch("/measures/#{id}"))
        item ? normalize(item, "measure") : demo_measures(nil).find { |measure| measure["id"].to_s == id.to_s }
      end

      # Unlike the other endpoints, this one doesn't read the bearer token: it
      # needs the API's Express session (the `connect.sid` cookie), which
      # the API creates on a token-authenticated request - and without it,
      # it hangs instead of answering 401. So it reuses the session set up by
      # an earlier call of this client (adding/refreshing a KPI always calls
      # /kpi/:id first), or opens one with /kpi. Short timeout and no retry
      # anyway: it's only for the optional history, and must not block
      # featuring a KPI.
      def historical_data(measurement:, bucket: "urbreath-auth")
        fetch("/kpi") if session_cookie.nil? && access_token.present?
        fetch("/historical-data/query/all", query: { bucket:, measurement:, kpimEngineRequest: false }, read_timeout: HISTORY_TIMEOUT)
      end

      # The most recent HISTORY_SIZE points of a normalized KPI/measure, as
      # `[[iso_time, value], ...]` sorted oldest first - what the public
      # gallery chart plots (see chart_preview.js) and what past
      # measurements are picked from (see kpi_modal.js). The measurement is
      # looked up by name in the KPI's tenant bucket. Empty when there is
      # no history (or no API), in which case the chart falls back to value
      # vs target.
      def history(item)
        # This endpoint hangs instead of refusing when it doesn't accept the
        # request (e.g. the token), so after one timeout the rest of this
        # client's calls (e.g. a bulk add/refresh) skip it instead of each
        # waiting HISTORY_TIMEOUT again.
        return [] if @history_unavailable

        bucket = item.dig("raw", "tenantId").presence || "urbreath-auth"
        payload = historical_data(measurement: item["name"], bucket:)
        return [] if payload.blank?

        points = history_records(payload).filter_map do |record|
          time = record["_time"] || record["time"] || record["timestamp"] || record["date"]
          value = record["_value"] || record["value"]
          parsed_time = Time.zone.parse(time.to_s) if time.present?
          next if parsed_time.nil? || !value.is_a?(Numeric)

          [parsed_time, value.is_a?(Float) ? value.round(2) : value]
        end

        # Sorted on the actual time: timestamps may switch UTC offset (DST).
        points.sort_by(&:first).last(HISTORY_SIZE).map { |time, value| [time.iso8601, value] }
      rescue ArgumentError
        []
      end

      private

      # Whole history as returned (about a week of hourly points), so past
      # measurements can be picked in the editor's KPI modal; the gallery
      # card's chart only plots the latest ones (Selection#chart_data).
      HISTORY_SIZE = 1000
      HISTORY_TIMEOUT = 8
      OPEN_TIMEOUT = 5
      READ_TIMEOUT = 20

      # The API answers with two parallel arrays (plus min/max/avg, unused):
      #   { "data": { "value": [8, 8.7, ...],
      #               "timestamp": ["2025-10-30T09:57:46.983+01:00", ...] } }
      # Raw InfluxDB-style records (a flat list, or grouped in tables) are
      # still accepted, in case other measurements come back that way.
      def history_records(payload)
        payload = unwrap(payload)
        case payload
        when Array then payload.flat_map { |entry| history_records(entry) }
        when Hash
          if payload["value"].is_a?(Array) && payload["timestamp"].is_a?(Array)
            return payload["timestamp"].zip(payload["value"]).map { |time, value| { "time" => time, "value" => value } }
          end

          nested = payload["records"] || payload["values"]
          nested.is_a?(Array) ? history_records(nested) : [payload]
        else
          []
        end
      end

      attr_reader :access_token, :base_url

      # The API's session cookie ("connect.sid=..."), kept in memory for
      # this client's lifetime (one Decidim request) only, see
      # #historical_data.
      attr_accessor :session_cookie

      SESSION_COOKIE = "connect.sid"

      def remember_session_cookie(response)
        Array(response.get_fields("set-cookie")).each do |header|
          pair = header.split(";", 2).first.to_s.strip
          self.session_cookie = pair if pair.start_with?("#{SESSION_COOKIE}=")
        end
      end

      def fetch(path, query: nil, read_timeout: READ_TIMEOUT)
        return nil if base_url.blank?

        uri = URI.join("#{base_url.chomp('/')}/", path.delete_prefix("/"))
        # Spaces as %20 rather than "+": measurement names can contain them
        # (e.g. "Avg Temp Aarhus"), and that's how the API is known to work.
        uri.query = URI.encode_www_form(query).gsub("+", "%20") if query.present?

        request = Net::HTTP::Get.new(uri)
        request["Authorization"] = "Bearer #{access_token}" if access_token.present?
        request["Accept"] = "application/json"
        request["Cookie"] = session_cookie if session_cookie

        # No automatic retry of the GET on timeout (Net::HTTP's default),
        # which would double the wait on an API that doesn't answer.
        response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https",
                                                           open_timeout: OPEN_TIMEOUT, read_timeout:, max_retries: 0) do |http|
          http.request(request)
        end
        remember_session_cookie(response)

        raise RequestError, "#{response.code} #{response.message}" unless response.is_a?(Net::HTTPSuccess)

        JSON.parse(response.body)
      rescue Net::ReadTimeout, Net::OpenTimeout => e
        @history_unavailable = true if path.start_with?("/historical-data")
        Rails.logger.warn("[Decidim::KpiManager] Could not fetch #{path}: #{e.class} (timeout, skipping history for the rest of this request)")
        nil
      rescue StandardError => e
        Rails.logger.warn("[Decidim::KpiManager] Could not fetch #{path}: #{e.message}")
        nil
      end

      UNIT_SYMBOLS = {
        "CELSIUS" => "°C",
        "FAHRENHEIT" => "°F",
        "PERCENT" => "%",
        "PERCENTAGE" => "%"
      }.freeze

      # The API wraps results in `{ "message": ..., "data": [...] }` (or a
      # single object under "data" for by-id requests). KPIs expose
      # `lastValue`/`lastUpdate` and `definition.unitMeasure`; measures are
      # assumed to follow the same conventions, with fallbacks for common
      # alternative key names. The raw payload is kept under "raw".
      def normalize(item, type)
        unit = item.dig("definition", "unitMeasure") || item["unit"] || item["uom"]

        {
          "id" => (item["id"] || item["uuid"] || item["_id"]).to_s,
          "type" => type,
          "name" => item["name"] || item["title"] || item["measurement"],
          "description" => item["description"],
          "value" => format_value(item["lastValue"] || item["value"] || item["currentValue"]),
          "unit" => UNIT_SYMBOLS.fetch(unit.to_s.upcase, unit),
          "target" => item.dig("definition", "targetValue"),
          "recorded_at" => (item["lastUpdate"] || item["recorded_at"] || item["timestamp"] || item["updatedAt"]).to_s[0, 10].presence,
          "source" => item["context"] || "URBREATH KPI Manager",
          "latitude" => item.dig("definition", "geolocation", "latitude") || item["latitude"],
          "longitude" => item.dig("definition", "geolocation", "longitude") || item["longitude"],
          "update_frequency" => update_frequency(item),
          "chart_type" => item.dig("dashboard", "chart", "type"),
          "raw" => item
        }
      end

      # How often the KPI data gets updated: KPIs are recalculated by a
      # scheduled job, exposed as `formula.job.schedule`, e.g.
      # `{ "time": "hour", "value": 2 }` (every 2 hours). Stored as
      # "<value> <time>" (e.g. "2 hour"), see
      # ApplicationHelper#kpi_update_frequency for how it's displayed.
      def update_frequency(item)
        schedule = item.dig("formula", "job", "schedule") || item.dig("job", "schedule") || item["schedule"]
        return nil unless schedule.is_a?(Hash) && schedule["time"].present?

        [schedule["value"].presence || 1, schedule["time"]].join(" ")
      end

      def normalize_collection(payload, type, query)
        items = payload.is_a?(Hash) ? Array(payload["data"] || payload["items"]) : Array(payload)
        filter(items.map { |item| normalize(item, type) }, query)
      end

      def unwrap(payload)
        payload.is_a?(Hash) && payload.key?("data") ? payload["data"] : payload
      end

      def format_value(value)
        value.is_a?(Float) ? value.round(2).to_s : value&.to_s
      end

      def demo_kpis(query)
        filter([
                  { "id" => "1", "type" => "kpi", "name" => "Air Quality Index", "value" => "42", "unit" => "µg/m³", "target" => 25, "recorded_at" => "2026-09-10", "update_frequency" => "1 hour", "chart_type" => "bar", "source" => "Demo data (no API configured)" },
                  { "id" => "2", "type" => "kpi", "name" => "Cyclist Flow", "value" => "1280", "unit" => "trips/day", "target" => 1500, "recorded_at" => "2026-09-18", "update_frequency" => "1 day", "chart_type" => "line", "source" => "Demo data (no API configured)" },
                  { "id" => "3", "type" => "kpi", "name" => "Noise Level", "value" => "58", "unit" => "dB", "recorded_at" => "2026-09-19", "source" => "Demo data (no API configured)" }
                ], query)
      end

      def demo_measures(query)
        filter([
                  { "id" => "101", "type" => "measure", "name" => "Street trees planted", "value" => "12", "unit" => "trees", "recorded_at" => "2026-08-01", "update_frequency" => "1 month", "source" => "Demo data (no API configured)" },
                  { "id" => "102", "type" => "measure", "name" => "Bike lane length", "value" => "3.4", "unit" => "km", "recorded_at" => "2026-07-15", "source" => "Demo data (no API configured)" }
                ], query)
      end

      def filter(items, query)
        return items if query.blank?

        items.select { |item| item["name"].to_s.downcase.include?(query.downcase) }
      end
    end
  end
end
