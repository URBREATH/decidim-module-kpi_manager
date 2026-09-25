# frozen_string_literal: true

module Decidim
  module KpiManager
    module Admin
      # Lets the space admin pick which of their own KPIs/measures (fetched
      # from the URBREATH API with their Keycloak session token) to feature
      # in this component's public gallery, and remove them again.
      class SelectionsController < Decidim::KpiManager::Admin::ApplicationController
        include Decidim::KpiManager::HasApiClient

        def index
          enforce_permission_to :read, :kpi_manager

          @selections = Decidim::KpiManager::Selection.where(component: current_component).order(created_at: :desc)
          selected_keys = @selections.pluck(:external_id, :kind).to_set
          @catalog = (api_client.kpis + api_client.measures).reject do |item|
            selected_keys.include?([item["id"], item["type"]])
          end
        end

        def create
          enforce_permission_to :read, :kpi_manager

          item = find_in_catalog(params[:external_id], params[:kind])
          return redirect_to selections_path, alert: t(".not_found") unless item

          selection = Decidim::KpiManager::Selection.new(item.slice("name", "description", "value", "unit", "recorded_at", "source").merge(
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
          enforce_permission_to :read, :kpi_manager

          selection = Decidim::KpiManager::Selection.where(component: current_component).find(params[:id])
          selection.destroy
          redirect_to selections_path, notice: t(".success")
        end

        private

        def find_in_catalog(external_id, kind)
          finder = kind == "measure" ? api_client.method(:find_measure) : api_client.method(:find_kpi)
          finder.call(external_id)
        end
      end
    end
  end
end
