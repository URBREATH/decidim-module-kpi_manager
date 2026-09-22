# frozen_string_literal: true

class CreateDecidimKpiManagerSelections < ActiveRecord::Migration[7.0]
  def change
    create_table :decidim_kpi_manager_selections do |t|
      t.references :decidim_component, null: false, foreign_key: { to_table: :decidim_components }, index: { name: "index_kpi_manager_selections_on_component" }
      t.references :decidim_user, null: false, foreign_key: { to_table: :decidim_users }, index: { name: "index_kpi_manager_selections_on_user" }

      t.string :external_id, null: false
      t.string :kind, null: false
      t.string :name
      t.string :value
      t.string :unit
      t.string :recorded_at
      t.string :source

      t.timestamps
    end

    add_index :decidim_kpi_manager_selections,
              [:decidim_component_id, :decidim_user_id, :external_id, :kind],
              unique: true,
              name: "index_kpi_manager_selections_uniqueness"
  end
end
