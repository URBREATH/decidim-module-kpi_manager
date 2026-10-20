# frozen_string_literal: true

module Decidim
  module KpiManager
    # A KPI or measure that a participant chose to feature in a KPI Manager
    # component instance. The data is a snapshot taken at selection time (see
    # Decidim::KpiManager::ApiClient#normalize), so the public gallery and the
    # editor picker never need to call the external API again.
    class Selection < ApplicationRecord
      belongs_to :component, foreign_key: "decidim_component_id", class_name: "Decidim::Component"
      belongs_to :author, foreign_key: "decidim_user_id", class_name: "Decidim::User"

      validates :external_id, :kind, :name, presence: true
      validates :external_id, uniqueness: { scope: [:decidim_component_id, :decidim_user_id, :kind] }

      def to_item
        {
          "id" => external_id,
          "type" => kind,
          "name" => name,
          "description" => description,
          "value" => value,
          "unit" => unit,
          "recorded_at" => recorded_at,
          "source" => source,
          "latitude" => latitude,
          "longitude" => longitude,
          "update_frequency" => update_frequency,
          "chart_type" => chart_type,
          "target" => target_value
        }
      end

      # How many of the latest history points the gallery card's chart plots.
      CHART_POINTS = 48

      # How many history points are kept at most: the API only returns the
      # latest ones, so each refresh adds to the snapshotted history (see
      # .merge_history) instead of replacing it, and older periods can still
      # be charted. About two years of hourly data.
      HISTORY_LIMIT = 20_000

      # `previous` and `latest` merged by time (latest wins), oldest first.
      def self.merge_history(previous, latest)
        points = (Array(previous) + Array(latest)).each_with_object({}) do |(time, value), merged|
          parsed = Time.zone.parse(time.to_s)
          merged[parsed.to_i] = [time, value] if parsed
        rescue ArgumentError
          next
        end

        points.sort.map(&:last).last(HISTORY_LIMIT)
      end

      # The history points from `from` (included) to `to` (excluded), either
      # of them being open when nil.
      def history_between(from, to)
        return Array(history) if from.nil? && to.nil?

        Array(history).select do |time, _value|
          parsed = Time.zone.parse(time.to_s)
          parsed && (from.nil? || parsed >= from) && (to.nil? || parsed < to)
        rescue ArgumentError
          false
        end
      end

      # Config read by chart_preview.js: the snapshotted history when there
      # is some, otherwise just the current value (vs its target).
      def chart_data
        {
          type: chart_type.presence || "bar",
          unit:,
          value: value.to_f,
          target: target_value.presence&.to_f,
          history: Array(history).last(CHART_POINTS)
        }
      end

      # The snapshotted history point measured at `time` (an ISO 8601
      # string, see Shortcode), as `[Time, value]`.
      def measurement_at(time)
        target = Time.zone.parse(time.to_s)
        return nil unless target

        Array(history).each do |point_time, point_value|
          parsed = Time.zone.parse(point_time.to_s)
          return [parsed, point_value] if parsed && (parsed - target).abs < 1
        end
        nil
      rescue ArgumentError
        nil
      end

      def chartable?
        history.present? || value.to_s.strip.match?(/\A-?\d+(\.\d+)?\z/)
      end

      def geolocated?
        latitude.present? && longitude.present?
      end
    end
  end
end
