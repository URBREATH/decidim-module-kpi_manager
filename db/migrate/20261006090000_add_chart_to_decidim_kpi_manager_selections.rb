# frozen_string_literal: true

class AddChartToDecidimKpiManagerSelections < ActiveRecord::Migration[7.0]
  def change
    add_column :decidim_kpi_manager_selections, :chart_type, :string
    add_column :decidim_kpi_manager_selections, :target_value, :string
    add_column :decidim_kpi_manager_selections, :history, :jsonb, null: false, default: []
  end
end
