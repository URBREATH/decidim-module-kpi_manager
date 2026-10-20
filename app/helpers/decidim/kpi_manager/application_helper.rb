# frozen_string_literal: true

module Decidim
  module KpiManager
    # Custom helpers, scoped to the kpi_manager engine.
    #
    module ApplicationHelper
      # Turns a stored update frequency (e.g. "2 hour", see
      # ApiClient#update_frequency) into "Every 2 hours". Units without a
      # translation are shown as they come from the API.
      def kpi_update_frequency(frequency)
        value, unit = frequency.to_s.split(" ", 2)
        count = Integer(value, exception: false)
        unit = unit.to_s.strip.downcase.delete_suffix("s")
        return frequency if count.nil? || unit.blank?

        t("decidim.kpi_manager.update_frequencies.#{unit}", count:, default: "#{count} #{unit}")
      end
    end
  end
end
