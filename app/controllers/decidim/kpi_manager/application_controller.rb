# frozen_string_literal: true

module Decidim
  module KpiManager
    # This controller is the abstract class from which all other controllers
    # of this engine inherit. KpiManager is a regular Decidim component, so it
    # inherits from Decidim::Components::BaseController like any other.
    class ApplicationController < Decidim::Components::BaseController
      include Decidim::KpiManager::HasApiClient

      helper Decidim::KpiManager::ApplicationHelper
    end
  end
end
