# frozen_string_literal: true

module Decidim
  module KpiManager
    # Lets the signed-in user browse their KPIs and measures. The HTML page
    # shows them as a compact list with a copy button; the JSON version feeds
    # the "KPI" button added to the rich text editor toolbar.
    class KpisController < Decidim::KpiManager::ApplicationController
      def index
        @kpis = api_client.kpis
        @measures = api_client.measures

        respond_to do |format|
          format.html
          format.json { render json: { labels: editor_labels, items: (@kpis + @measures).map { |item| serialize(item) } } }
        end
      end

      private

      def editor_labels
        I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s)
      end

      def serialize(item)
        item.slice("id", "type", "name", "value", "unit", "recorded_at", "source")
            .merge("shortcode" => Decidim::KpiManager::Shortcode.build(item))
      end
    end
  end
end
