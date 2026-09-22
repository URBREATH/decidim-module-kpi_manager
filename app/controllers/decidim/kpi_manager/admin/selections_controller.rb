# frozen_string_literal: true

module Decidim
  module KpiManager
    module Admin
      # Lets space admins moderate (remove) KPIs/measures that participants
      # featured in this component. There is nothing to configure otherwise:
      # participants pick their own KPIs from the public side.
      class SelectionsController < Decidim::KpiManager::Admin::ApplicationController
        def index
          enforce_permission_to :read, :kpi_manager
          @selections = Decidim::KpiManager::Selection.where(component: current_component).order(created_at: :desc)
        end

        def destroy
          enforce_permission_to :read, :kpi_manager
          selection = Decidim::KpiManager::Selection.where(component: current_component).find(params[:id])
          selection.destroy
          redirect_to selections_path, notice: t(".success")
        end
      end
    end
  end
end
