# frozen_string_literal: true

require "rails"
require "decidim/core"

module Decidim
  module KpiManager
    # This is the engine that runs on the public interface of kpi_manager.
    class Engine < ::Rails::Engine
      isolate_namespace Decidim::KpiManager

      routes do
        resources :selections, only: [:index]
        root to: "selections#index"
      end

      # Rich text written by admins (e.g. blog posts) is displayed through
      # `decidim_rich_text` without going through Decidim.content_processors,
      # so expand the [[kpi ...]] shortcodes there too.
      config.to_prepare do
        Decidim::SanitizeHelper.prepend(Decidim::KpiManager::RichTextExtension)
      end

      initializer "KpiManager.content_processors" do
        Decidim.content_processors += [:kpi]
      end

      # Decidim's default Content-Security-Policy only allows img-src/
      # connect-src from *.hereapi.com (its documented default map
      # provider), regardless of whether Decidim.maps is actually
      # configured. The KPI card's map uses OpenStreetMap tiles directly via
      # Leaflet (see map_preview.js), so those need to be allowed too, or
      # the browser silently blocks the tile images (the marker still shows,
      # since it's a same-origin bundled asset - only the tiles are affected).
      initializer "KpiManager.content_security_policy" do
        extra = Decidim.content_security_policies_extra.dup
        %w(img-src connect-src).each do |directive|
          extra[directive] = Array(extra[directive]) + ["*.tile.openstreetmap.org"]
        end
        Decidim.content_security_policies_extra = extra
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
