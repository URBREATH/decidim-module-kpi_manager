# frozen_string_literal: true

module Decidim
  module KpiManager
    # A KPI or measure that a participant chose to feature in a KPI Manager
    # component instance. The data is a snapshot taken at selection time (see
    # Decidim::KpiManager::ApiClient#normalize), so the public gallery and the
    # editor picker never need to call the external API again.
    class Selection < ApplicationRecord
      belongs_to :component, foreign_key: "decidim_component_id", class_name: "Decidim::Component"
      belongs_to :author, foreign_key: "decidim_user_id", class_name: "Decidim::User"

      validates :external_id, :kind, :name, presence: true
      validates :external_id, uniqueness: { scope: [:decidim_component_id, :decidim_user_id, :kind] }

      def to_item
        {
          "id" => external_id,
          "type" => kind,
          "name" => name,
          "value" => value,
          "unit" => unit,
          "recorded_at" => recorded_at,
          "source" => source
        }
      end
    end
  end
end
