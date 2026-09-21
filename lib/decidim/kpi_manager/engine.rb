# frozen_string_literal: true

require "rails"
require "decidim/core"

module Decidim
  module KpiManager
    # This is the engine that runs on the public interface of kpi_manager.
    class Engine < ::Rails::Engine
      isolate_namespace Decidim::KpiManager

      routes do
        resources :kpis, only: [:index]
        root to: "kpis#index"
      end

      initializer "KpiManager.user_menu" do
        Decidim.menu :user_menu do |menu|
          menu.add_item :kpi_manager,
                        I18n.t("menu.kpi_manager", scope: "decidim.kpi_manager"),
                        decidim_kpi_manager.root_path,
                        position: 5.0,
                        active: :inclusive
        end
      end

      initializer "KpiManager.content_processors" do
        Decidim.content_processors += [:kpi]
      end

      initializer "KpiManager.shakapacker.assets_path" do
        Decidim.register_assets_path File.expand_path("app/packs", root)
      end

      initializer "KpiManager.data_migrate", after: "decidim_core.data_migrate" do
        DataMigrate.configure do |config|
          config.data_migrations_path << root.join("db/data").to_s
        end
      end
    end
  end
end
