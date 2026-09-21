# frozen_string_literal: true

require "decidim/kpi_manager/engine"
require "decidim/kpi_manager/shortcode"
require "decidim/kpi_manager/api_client"
require "decidim/content_parsers/kpi_parser"
require "decidim/content_renderers/kpi_renderer"
require "decidim/kpi_manager/admin"
require "decidim/kpi_manager/admin_engine"
require "decidim/kpi_manager/component"

module Decidim
  # This namespace holds the logic of the `KpiManager` module, which lets
  # signed-in users browse their KPIs and measures (fetched from an external
  # API using their Keycloak access token) and embed them as evidence in any
  # rich text content across Decidim (proposals, blog posts, etc).
  module KpiManager
    # Base URL of the external KPI Manager API (URBREATH KPI Manager), e.g.
    # "https://kpim-mid-dev.urbreath.tech/api/v1/urbreath-auth". When blank,
    # ApiClient falls back to a small demo dataset, which is useful for local
    # development. Configure it from the host app, e.g. in an initializer:
    #
    #   Decidim::KpiManager.api_base_url = ENV["KPI_MANAGER_API_BASE_URL"]
    class << self
      attr_accessor :api_base_url
    end
  end
end
