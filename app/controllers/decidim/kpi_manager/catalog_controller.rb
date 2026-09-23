# frozen_string_literal: true

module Decidim
  module KpiManager
    # Small endpoint used by the "Insert KPI" editor button (added to every
    # rich text editor, see editor_button.js): returns the signed-in user's
    # full KPI/measure catalog from the URBREATH API (their own data, scoped
    # by their Keycloak session token) - not just what has been featured in
    # any one component instance.
    #
    # This lives outside Decidim::KpiManager::Engine (which is mounted per
    # component instance) because it needs to be reachable from any page,
    # regardless of which component the author is currently writing in.
    class CatalogController < Decidim::ApplicationController
      include Decidim::KpiManager::HasApiClient

      def index
        render json: {
          labels: I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s),
          items: (api_client.kpis + api_client.measures).map { |item| serialize(item) }
        }
      end

      private

      def serialize(item)
        item.slice("id", "type", "name", "value", "unit", "recorded_at", "source")
            .merge("shortcode" => Decidim::KpiManager::Shortcode.build(item))
      end
    end
  end
end
