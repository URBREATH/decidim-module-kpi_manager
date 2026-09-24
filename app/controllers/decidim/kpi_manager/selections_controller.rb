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

      private

      def serialize(selection)
        selection.to_item.merge("shortcode" => Decidim::KpiManager::Shortcode.build(selection.to_item))
      end
    end
  end
end
