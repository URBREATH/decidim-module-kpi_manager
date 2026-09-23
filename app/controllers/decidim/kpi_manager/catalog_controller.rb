# frozen_string_literal: true

module Decidim
  module KpiManager
    # Small endpoint used by the "Insert KPI" editor button (added to every
    # rich text editor, see editor_button.js): returns the signed-in user's
    # full KPI/measure catalog from the URBREATH API (their own data, scoped
    # by their Keycloak session token) - not just what has been featured in
    # any one component instance - plus the URL of the current participatory
    # space's KPI gallery (if it has one), so inserted items can link there.
    #
    # This lives outside Decidim::KpiManager::Engine (which is mounted per
    # component instance) because it needs to be reachable from any page,
    # regardless of which component the author is currently writing in.
    class CatalogController < Decidim::ApplicationController
      include Decidim::KpiManager::HasApiClient
      include Decidim::ComponentPathHelper

      def index
        render json: {
          labels: I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s),
          gallery_url:,
          items: (api_client.kpis + api_client.measures).map { |item| item.slice("id", "type", "name", "value", "unit", "recorded_at", "source") }
        }
      end

      private

      def gallery_url
        component ? main_component_path(component) : nil
      end

      def component
        @component ||= participatory_space&.components&.find do |candidate|
          candidate.manifest_name == "kpi_manager" && candidate.published?
        end
      end

      def participatory_space
        return nil if params[:participatory_space_gid].blank?

        space = GlobalID::Locator.locate(params[:participatory_space_gid])
        space if space.respond_to?(:organization) && space.organization == current_organization
      rescue ActiveRecord::RecordNotFound, URI::InvalidURIError
        nil
      end
    end
  end
end
