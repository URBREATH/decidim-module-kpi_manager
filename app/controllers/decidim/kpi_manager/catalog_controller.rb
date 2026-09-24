# frozen_string_literal: true

module Decidim
  module KpiManager
    # Small endpoint used by the "Insert KPI" editor button (added to every
    # rich text editor, see editor_button.js): returns the KPIs/measures
    # featured in the current participatory space's KPI component (the same
    # ones shown in its public gallery, see SelectionsController#index) -
    # not the author's whole catalog - plus the URL of that gallery, so
    # inserted items can link there.
    #
    # This lives outside Decidim::KpiManager::Engine (which is mounted per
    # component instance) because it needs to be reachable from any page,
    # regardless of which component the author is currently writing in.
    class CatalogController < Decidim::ApplicationController
      include Decidim::ComponentPathHelper

      def index
        render json: {
          labels: I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s),
          gallery_url:,
          items: selections.map { |selection| serialize(selection) }
        }
      end

      private

      def selections
        return [] unless component

        Selection.where(component:).order(created_at: :desc)
      end

      def serialize(selection)
        selection.to_item
      end

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
