# frozen_string_literal: true

module Decidim
  module KpiManager
    # Builds and parses the `[[kpi ...]]` shortcode used to embed a KPI or
    # measure snapshot inside any Decidim rich text content. The snapshot
    # (name/value/unit/date/source) is embedded in the tag itself, so
    # rendering it never needs a live API call or the author's access token.
    module Shortcode
      TAG_REGEX = /\[\[kpi\s+([^\]]+)\]\]/

      ATTRIBUTES = %w(id type name value unit recorded_at source).freeze

      def self.build(item)
        attrs = ATTRIBUTES.map { |key| %(#{key}="#{escape(item[key].to_s)}") }.join(" ")
        "[[kpi #{attrs}]]"
      end

      def self.parse(tag_body)
        tag_body.scan(/(\w+)="([^"]*)"/).to_h
      end

      def self.escape(value)
        value.tr('"', "'").delete("[]")
      end
    end
  end
end
