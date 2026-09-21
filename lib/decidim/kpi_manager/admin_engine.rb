# frozen_string_literal: true

module Decidim
  module KpiManager
    # This is the engine that runs on the public interface of `KpiManager`.
    class AdminEngine < ::Rails::Engine
      isolate_namespace Decidim::KpiManager::Admin

      paths["db/migrate"] = nil
      paths["lib/tasks"] = nil

      routes do
        # Add admin engine routes here
        # resources :kpi_manager do
        #   collection do
        #     resources :exports, only: [:create]
        #   end
        # end
        # root to: "kpi_manager#index"
      end

      def load_seed
        nil
      end
    end
  end
end
