# frozen_string_literal: true

class AddDescriptionToDecidimKpiManagerSelections < ActiveRecord::Migration[7.0]
  def change
    add_column :decidim_kpi_manager_selections, :description, :text
  end
end
