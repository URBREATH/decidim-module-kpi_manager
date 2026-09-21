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

      def historical_data(measurement:, bucket: "urbreath-auth")
        fetch("/historical-data/query/all", query: { bucket:, measurement:, kpimEngineRequest: false })
      end

      private

      attr_reader :access_token, :base_url

      def fetch(path, query: nil)
        return nil if base_url.blank?

        uri = URI.join("#{base_url.chomp('/')}/", path.delete_prefix("/"))
        uri.query = URI.encode_www_form(query) if query.present?

        request = Net::HTTP::Get.new(uri)
        request["Authorization"] = "Bearer #{access_token}" if access_token.present?
        request["Accept"] = "application/json"

        response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
          http.request(request)
        end

        raise RequestError, "#{response.code} #{response.message}" unless response.is_a?(Net::HTTPSuccess)

        JSON.parse(response.body)
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
          "raw" => item
        }
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
                  { "id" => "1", "type" => "kpi", "name" => "Air Quality Index", "value" => "42", "unit" => "µg/m³", "recorded_at" => "2026-09-10", "source" => "Demo data (no API configured)" },
                  { "id" => "2", "type" => "kpi", "name" => "Cyclist Flow", "value" => "1280", "unit" => "trips/day", "recorded_at" => "2026-09-18", "source" => "Demo data (no API configured)" },
                  { "id" => "3", "type" => "kpi", "name" => "Noise Level", "value" => "58", "unit" => "dB", "recorded_at" => "2026-09-19", "source" => "Demo data (no API configured)" }
                ], query)
      end

      def demo_measures(query)
        filter([
                  { "id" => "101", "type" => "measure", "name" => "Street trees planted", "value" => "12", "unit" => "trees", "recorded_at" => "2026-08-01", "source" => "Demo data (no API configured)" },
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
