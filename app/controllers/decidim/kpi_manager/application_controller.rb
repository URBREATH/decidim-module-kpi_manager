# frozen_string_literal: true

module Decidim
  module KpiManager
    # This controller is the abstract class from which all other controllers
    # of this engine inherit. KpiManager is a regular Decidim component, so it
    # inherits from Decidim::Components::BaseController like any other.
    class ApplicationController < Decidim::Components::BaseController
      private

      def api_client
        @api_client ||= Decidim::KpiManager::ApiClient.new(access_token: session[:keycloak_access_token])
      end
    end
  end
end
