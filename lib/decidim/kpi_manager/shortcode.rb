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
    module Shortcode
      TAG_REGEX = /\[\[KPI:\s*([^\]]+)\]\]/i

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
