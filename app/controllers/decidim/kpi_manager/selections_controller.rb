# frozen_string_literal: true

module Decidim
  module KpiManager
    # Public gallery of the KPIs/measures participants featured in this
    # component, plus the management actions to add/remove your own.
    class SelectionsController < Decidim::KpiManager::ApplicationController
      before_action :authenticate_user!, only: [:create, :destroy]

      def index
        @selections = Selection.where(component: current_component).order(created_at: :desc)

        if current_user
          selected_keys = @selections.where(author: current_user).pluck(:external_id, :kind).to_set
          @catalog = (api_client.kpis + api_client.measures).reject do |item|
            selected_keys.include?([item["id"], item["type"]])
          end
        end

        respond_to do |format|
          format.html
          format.json { render json: { items: @selections.map { |selection| serialize(selection) } } }
        end
      end

      def create
        item = find_in_catalog(params[:external_id], params[:kind])
        return redirect_to selections_path, alert: t(".not_found") unless item

        selection = Selection.new(item.slice("name", "value", "unit", "recorded_at", "source").merge(
                                     component: current_component,
                                     author: current_user,
                                     external_id: item["id"],
                                     kind: item["type"]
                                   ))

        if selection.save
          redirect_to selections_path, notice: t(".success")
        else
          redirect_to selections_path, alert: selection.errors.full_messages.to_sentence
        end
      end

      def destroy
        selection = Selection.where(component: current_component, author: current_user).find(params[:id])
        selection.destroy
        redirect_to selections_path, notice: t(".success")
      end

      private

      def find_in_catalog(external_id, kind)
        finder = kind == "measure" ? api_client.method(:find_measure) : api_client.method(:find_kpi)
        finder.call(external_id)
      end

      def serialize(selection)
        selection.to_item.merge("shortcode" => Decidim::KpiManager::Shortcode.build(selection.to_item))
      end
    end
  end
end
