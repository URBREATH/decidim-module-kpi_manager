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
        end
        root to: "selections#index"
      end

      def load_seed
        nil
      end
    end
  end
end
