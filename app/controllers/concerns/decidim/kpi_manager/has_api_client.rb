# frozen_string_literal: true

module Decidim
  module KpiManager
    # Shared by the public and admin controllers: gives access to the
    # current user's KPIs/measures via the URBREATH API, authenticated with
    # their Keycloak access token (the same one used to sign in to Decidim,
    # stored in the session by decidim-module-keycloak). The admin and public
    # controllers use different base classes, but share the same Rails
    # session, so the token is available in both.
    module HasApiClient
      extend ActiveSupport::Concern

      private

      def api_client
        @api_client ||= Decidim::KpiManager::ApiClient.new(access_token: session[:keycloak_access_token])
      end
    end
  end
end
