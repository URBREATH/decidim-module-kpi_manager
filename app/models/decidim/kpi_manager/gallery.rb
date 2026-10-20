# frozen_string_literal: true

module Decidim
  module KpiManager
    # The public KPI gallery of a participatory space: its published KPI
    # Manager component, whose featured KPIs the KPI buttons (rich text
    # editor and comment form) offer to insert.
    module Gallery
      # Also used by other modules' views (e.g. the comment form cell
      # overridden by decidim-idra) to only show the KPI button where there
      # is something to insert.
      def self.component_for(space)
        return nil unless space.respond_to?(:components)

        space.components.find { |component| component.manifest_name == "kpi_manager" && component.published? }
      end
    end
  end
end
