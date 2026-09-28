# frozen_string_literal: true

class AddGeolocationToDecidimKpiManagerSelections < ActiveRecord::Migration[7.0]
  def change
    add_column :decidim_kpi_manager_selections, :latitude, :float
    add_column :decidim_kpi_manager_selections, :longitude, :float
  end
end
