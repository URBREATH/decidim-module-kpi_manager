# frozen_string_literal: true

class AddUpdateFrequencyToDecidimKpiManagerSelections < ActiveRecord::Migration[7.0]
  def change
    add_column :decidim_kpi_manager_selections, :update_frequency, :string
  end
end
