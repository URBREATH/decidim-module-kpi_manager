# frozen_string_literal: true

module Decidim
  module ContentRenderers
    # A renderer that replaces `[[kpi ...]]` shortcodes with a small card
    # showing the embedded KPI/measure snapshot. Works in any rich text field
    # across Decidim (proposals, blog posts, meetings...) since the data was
    # captured into the tag itself when it was inserted - no API call needed.
    #
    # @see Decidim::KpiManager::Shortcode
    class KpiRenderer < BaseRenderer
      def render(_options = {})
        return content unless content.is_a?(String)

        content.gsub(Decidim::KpiManager::Shortcode::TAG_REGEX) do
          attrs = Decidim::KpiManager::Shortcode.parse(Regexp.last_match(1))
          render_card(attrs)
        end
      end

      private

      def render_card(attrs)
        <<~HTML.squish
          <span class="kpi-manager-embed">
            <strong class="kpi-manager-embed__name">#{ERB::Util.html_escape(attrs["name"])}</strong>
            <span class="kpi-manager-embed__value">#{ERB::Util.html_escape(attrs["value"])} #{ERB::Util.html_escape(attrs["unit"])}</span>
            <span class="kpi-manager-embed__meta">#{ERB::Util.html_escape(attrs["source"])} &middot; #{ERB::Util.html_escape(attrs["recorded_at"])}</span>
          </span>
        HTML
      end
    end
  end
end
