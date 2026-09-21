# frozen_string_literal: true

module Decidim
  module KpiManager
    # This controller is the abstract class from which all other controllers of
    # this engine inherit. KpiManager is mounted as a global engine (not tied to
    # a participatory space), so it inherits directly from Decidim::ApplicationController.
    class ApplicationController < Decidim::ApplicationController
      before_action :authenticate_user!

      private

      def api_client
        @api_client ||= Decidim::KpiManager::ApiClient.new(access_token: session[:keycloak_access_token])
      end
    end
  end
end
