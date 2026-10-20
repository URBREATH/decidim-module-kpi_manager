# frozen_string_literal: true

module Decidim
  module ContentRenderers
    # A renderer that replaces `[[KPI: ...]]` tags with a small card showing
    # the embedded KPI/measure snapshot. Works in any rich text field across
    # Decidim (proposals, blog posts, meetings...) since the data was
    # captured into the tag itself when it was inserted - no API call needed.
    #
    # Tags carrying a featured selection's id (`[[KPI#17: ...]]`, inserted in
    # comments) become instead the same bold link the rich text editor
    # inserts: pointing to the KPI gallery, with the hover card data in its
    # query string (see editor_button.js and link_preview.js). Those with a
    # period (`[[KPI#17~day/2026-09-01/2026-09-30: ...]]`) also carry the
    # `kpi_chart` param, from which inline_chart.js draws the period's chart.
    #
    # @see Decidim::KpiManager::Shortcode
    class KpiRenderer < BaseRenderer
      def render(_options = {})
        return content unless content.is_a?(String)

        content.gsub(Decidim::KpiManager::Shortcode::TAG_REGEX) do
          selection_id, measured_at, granularity, from, to, body = Regexp.last_match.captures
          attrs = Decidim::KpiManager::Shortcode.parse(body)
          selection = find_selection(selection_id)
          period = parse_period(granularity, from, to)

          if selection && period
            render_link(selection, nil, period)
          elsif selection
            render_link(selection, measurement(selection, measured_at, attrs))
          else
            render_card(attrs)
          end
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

      # Same markup and query string format as kpi_modal.js#buildHref /
      # #buildLinkHtml, so link_preview.js shows the same hover card. Uses
      # the selection's current snapshot, not the one in the tag - except
      # for a past measurement (`{ time:, value: }`), which never changes.
      def render_link(selection, measurement, period = nil)
        value = measurement ? measurement[:value] : selection.value
        when_label = measurement && I18n.l(measurement[:time], format: :decidim_short)
        period_label = period && period_label(period)
        text = if period_label
                 I18n.t("decidim.kpi_manager.editor.chart_link", name: selection.name, period: period_label)
               else
                 name = when_label ? "#{selection.name} (#{when_label})" : selection.name
                 "#{name}: #{[value, selection.unit].compact_blank.join(" ")}".strip
               end

        featured_by = I18n.t("decidim.kpi_manager.editor.featured_by", name: Decidim::UserPresenter.new(selection.author).name)
        data = ["KPI", selection.name, selection.description, value, selection.unit, selection.source, selection.recorded_at, featured_by, when_label, period_label]
               .map { |part| part.to_s.tr("|", "/") }.join("|")
        query = { kpi: data }
        query[:kpi_chart] = [selection.id, period[:granularity], period[:from].iso8601, period[:to].iso8601].join("~") if period
        href = "#{Decidim::EngineRouter.main_proxy(selection.component).root_path}?#{query.to_query}"

        %(<a href="#{ERB::Util.html_escape(href)}" class="kpi-manager-link"><strong>#{ERB::Util.html_escape(text)}</strong></a>)
      end

      # A past measurement's time and value, taken from the selection's
      # snapshotted history when it still has that point (so the value
      # can't be edited by hand in the tag), or else from the tag itself.
      def measurement(selection, measured_at, attrs)
        return nil if measured_at.blank?

        time, value = selection.measurement_at(measured_at)
        return { time:, value: } if time

        time = Time.zone.parse(measured_at)
        time && { time:, value: attrs["value"] }
      rescue ArgumentError
        nil
      end

      def parse_period(granularity, from, to)
        return nil if granularity.blank?

        from = Date.iso8601(from)
        to = Date.iso8601(to)
        from <= to ? { granularity: granularity.downcase, from:, to: } : nil
      rescue Date::Error
        nil
      end

      # Same as history.js#formatPeriod, e.g. "September 2026 - October 2026".
      def period_label(period)
        format = { "day" => :decidim_short, "month" => "%B %Y", "year" => "%Y" }.fetch(period[:granularity])
        from, to = period.values_at(:from, :to).map { |date| I18n.l(date, format:) }
        from == to ? from : "#{from} – #{to}"
      end

      # Only selections still featured in a published KPI component.
      def find_selection(id)
        return nil if id.blank?

        selection = Decidim::KpiManager::Selection.includes(:component, :author).find_by(id:)
        selection if selection&.component&.published?
      end
    end
  end
end
