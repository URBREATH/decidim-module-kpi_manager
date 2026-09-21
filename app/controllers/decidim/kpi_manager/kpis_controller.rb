# frozen_string_literal: true

module Decidim
  module KpiManager
    # Lets the signed-in user browse their KPIs and measures, and grab the
    # embed snippet to paste into any rich text content (proposals, blog
    # posts, etc).
    class KpisController < Decidim::KpiManager::ApplicationController
      def index
        @kpis = api_client.kpis
        @measures = api_client.measures
      end
    end
  end
end
