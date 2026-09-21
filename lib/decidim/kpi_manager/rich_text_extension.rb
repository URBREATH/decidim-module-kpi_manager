# frozen_string_literal: true

module Decidim
  module KpiManager
    # Prepended to Decidim::SanitizeHelper so that `decidim_rich_text` (used
    # to display admin-authored rich text such as blog posts) also expands the
    # `[[kpi ...]]` shortcodes into their embedded card.
    module RichTextExtension
      def decidim_rich_text(html, **)
        rendered = super
        return rendered unless rendered.is_a?(String) && rendered.include?("[[kpi")

        Decidim::ContentRenderers::KpiRenderer.new(rendered).render.html_safe
      end
    end
  end
end
