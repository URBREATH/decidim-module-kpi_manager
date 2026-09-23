# frozen_string_literal: true

module Decidim
  module KpiManager
    # Public gallery of the KPIs/measures the space admin featured in this
    # component. Selecting which ones to feature happens from the admin
    # panel (see Decidim::KpiManager::Admin::SelectionsController).
    class SelectionsController < Decidim::KpiManager::ApplicationController
      def index
        @selections = Selection.where(component: current_component).order(created_at: :desc)

        respond_to do |format|
          format.html
          format.json { render json: { items: @selections.map { |selection| serialize(selection) } } }
        end
      end

      # The measures a featured KPI is computed from, fetched on demand when
      # its card is expanded (see app/packs/src/decidim/kpi_manager/card_expand.js).
      # Only meaningful for KPIs, not for measures themselves.
      def measures
        selection = Selection.where(component: current_component).find(params[:id])
        items = selection.kind == "kpi" ? api_client.measures_for_kpi(selection.external_id) : []

        render json: { items: }
      end

      private

      def serialize(selection)
        selection.to_item.merge("shortcode" => Decidim::KpiManager::Shortcode.build(selection.to_item))
      end
    end
  end
end
