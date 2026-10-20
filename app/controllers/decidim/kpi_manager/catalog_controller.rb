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
    # #history returns a featured KPI's snapshotted value history, for the
    # modal's period picker and the period charts embedded in content (see
    # history.js), loaded apart since it can be long.
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

      # Optionally only between `from` and `to` (ISO 8601 times, `to`
      # excluded). Only for selections of a published KPI component of this
      # organization, i.e. those whose (latest) history the public gallery
      # shows anyway.
      def history
        selection = Selection.includes(:component).find_by(id: params[:id])
        component = selection&.component
        return head :not_found unless component&.published? && component.organization == current_organization

        render json: {
          name: selection.name,
          unit: selection.unit,
          target: selection.target_value.presence&.to_f,
          chart_type: selection.chart_type,
          labels: I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s),
          history: selection.history_between(parse_time(params[:from]), parse_time(params[:to]))
        }
      end

      private

      def parse_time(value)
        Time.zone.iso8601(value.to_s) if value.present?
      rescue ArgumentError
        nil
      end

      def selections
        return [] unless component

        Selection.where(component:).order(created_at: :desc)
      end

      def serialize(selection)
        # The history itself is loaded by the KPI modal when needed (#history).
        selection.to_item.merge(
          "featured_by" => helpers.present(selection.author).name,
          "selection_id" => selection.id,
          "has_history" => selection.history.present?
        )
      end

      def gallery_url
        component ? main_component_path(component) : nil
      end

      def component
        @component ||= Decidim::KpiManager::Gallery.component_for(participatory_space)
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
