# frozen_string_literal: true

module Decidim
  module KpiManager
    # Builds and parses the `[[KPI: ...]]` tag used to embed a KPI or measure
    # snapshot inside any Decidim rich text content. The snapshot
    # (name/value/unit/date/source) is embedded in the tag itself, so
    # rendering it never needs a live API call or the author's access token.
    #
    # The format reads as plain text on purpose - e.g.
    # "[[KPI: AvgTempAthens | 22.37 °C | ATHENS | 2026-09-08]]" - so it stays
    # legible while it's still raw text in the editor, before it gets
    # rendered into a card.
    #
    # Comments (plain text, whose sanitizer strips every link) get the tag
    # with the featured selection's id, e.g. "[[KPI#17: AvgTempAthens | ...]]"
    # (see kpi_modal.js), which KpiRenderer turns into a link to that KPI's
    # card in the gallery. A past measurement adds its ISO 8601 time, e.g.
    # "[[KPI#17@2025-11-03T13:00:06Z: AvgTempTallin | 12.93 °C | ...]]",
    # and the chart of a period its granularity and first/last days, e.g.
    # "[[KPI#17~month/2026-09-01/2026-10-31: AvgTempAthens | ...]]".
    module Shortcode
      ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/
      DAY = /\d{4}-\d{2}-\d{2}/
      PERIOD = %r{~(day|month|year)/(#{DAY})/(#{DAY})}
      # Captures: 1 selection id, 2 measurement time, 3-5 period granularity,
      # first and last day, 6 readable body.
      TAG_REGEX = /\[\[KPI(?:#(\d+)(?:@(#{ISO_TIME})|#{PERIOD})?)?:\s*([^\]]+)\]\]/i

      def self.build(item)
        value_and_unit = [item["value"], item["unit"]].compact_blank.join(" ")
        parts = [item["name"], value_and_unit, item["source"], item["recorded_at"]].map { |part| escape(part) }

        "[[KPI: #{parts.join(" | ")}]]"
      end

      def self.parse(tag_body)
        name, value_unit, source, recorded_at = tag_body.split("|").map { |part| part.to_s.strip }
        value, unit = value_unit.to_s.split(" ", 2)

        { "name" => name, "value" => value, "unit" => unit, "source" => source, "recorded_at" => recorded_at }
      end

      def self.escape(value)
        value.to_s.tr("|", "/").delete("[]").strip
      end
    end
  end
end
