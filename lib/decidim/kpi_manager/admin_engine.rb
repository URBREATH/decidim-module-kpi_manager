# frozen_string_literal: true

module Decidim
  module KpiManager
    # This is the engine that runs on the public interface of `KpiManager`.
    class AdminEngine < ::Rails::Engine
      isolate_namespace Decidim::KpiManager::Admin

      paths["db/migrate"] = nil
      paths["lib/tasks"] = nil

      routes do
        resources :selections, only: [:index, :create, :destroy] do
          member { patch :refresh }
          # Bulk actions on the checked rows of the featured list.
          collection do
            patch :bulk_refresh
            delete :bulk_destroy
          end
        end
        root to: "selections#index"
      end

      def load_seed
        nil
      end
    end
  end
end
