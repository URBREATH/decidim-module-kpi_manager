# frozen_string_literal: true

module Decidim
  module KpiManager
    module Admin
      # Lets the space admin pick which of their own KPIs/measures (fetched
      # from the URBREATH API with their Keycloak session token) to feature
      # in this component's public gallery, and remove them again.
      class SelectionsController < Decidim::KpiManager::Admin::ApplicationController
        include Decidim::KpiManager::HasApiClient

        def index
          enforce_permission_to :read, :kpi_manager

          @selections = Decidim::KpiManager::Selection.where(component: current_component).order(created_at: :desc)
          selected_keys = @selections.pluck(:external_id, :kind).to_set
          @catalog = (api_client.kpis + api_client.measures).reject do |item|
            selected_keys.include?([item["id"], item["type"]])
          end
        end

        def create
          enforce_permission_to :read, :kpi_manager
          return bulk_create if params.key?(:items)

          item = find_in_catalog(params[:external_id], params[:kind])
          return redirect_to selections_path, alert: t(".not_found") unless item

          selection = Decidim::KpiManager::Selection.new(snapshot(item).merge(
                                                             component: current_component,
                                                             author: current_user,
                                                             external_id: item["id"],
                                                             kind: item["type"]
                                                           ))

          if selection.save
            redirect_to selections_path, notice: t(".success")
          else
            redirect_to selections_path, alert: selection.errors.full_messages.to_sentence
          end
        end

        def destroy
          enforce_permission_to :read, :kpi_manager

          selection = Decidim::KpiManager::Selection.where(component: current_component).find(params[:id])
          selection.destroy
          redirect_to selections_path, notice: t(".success")
        end

        # Re-fetches this KPI/measure from the API and overwrites the saved
        # snapshot with it - e.g. to pick up a description or a value that
        # wasn't captured when it was first featured.
        def refresh
          enforce_permission_to :read, :kpi_manager

          selection = Decidim::KpiManager::Selection.where(component: current_component).find(params[:id])
          item = find_in_catalog(selection.external_id, selection.kind)
          return redirect_to selections_path, alert: t(".not_found") unless item

          if selection.update(snapshot(item, selection.history))
            redirect_to selections_path, notice: t(".success")
          else
            redirect_to selections_path, alert: selection.errors.full_messages.to_sentence
          end
        end

        def bulk_destroy
          enforce_permission_to :read, :kpi_manager

          selections = bulk_selections
          return redirect_to selections_path, alert: t(".none_selected") if selections.empty?

          selections.each(&:destroy)
          redirect_to selections_path, notice: t(".success", count: selections.size)
        end

        # Same as #refresh, for each checked selection. Sequential API calls
        # (item + history each), so it takes a while with many selections.
        def bulk_refresh
          enforce_permission_to :read, :kpi_manager

          selections = bulk_selections
          return redirect_to selections_path, alert: t(".none_selected") if selections.empty?

          failed = selections.reject do |selection|
            item = find_in_catalog(selection.external_id, selection.kind)
            item && selection.update(snapshot(item, selection.history))
          end

          if failed.empty?
            redirect_to selections_path, notice: t(".success", count: selections.size)
          else
            redirect_to selections_path, alert: t(".partial", count: selections.size - failed.size, failed: failed.map(&:name).to_sentence)
          end
        end

        private

        # "Add selected" on the catalog list: #create with `items[]` as
        # "<kind>:<external id>" (kept on the existing create route, so it
        # needs no new route).
        def bulk_create
          keys = Array(params[:items]).filter_map { |key| key.to_s.split(":", 2).presence }.select { |pair| pair.size == 2 }
          return redirect_to selections_path, alert: t(".none_selected") if keys.empty?

          failed = keys.filter_map do |kind, external_id|
            item = find_in_catalog(external_id, kind)
            next external_id unless item

            selection = Decidim::KpiManager::Selection.new(snapshot(item).merge(
                                                               component: current_component,
                                                               author: current_user,
                                                               external_id: item["id"],
                                                               kind: item["type"]
                                                             ))
            selection.save ? nil : item["name"]
          end

          added = keys.size - failed.size
          if failed.empty?
            redirect_to selections_path, notice: t(".bulk_success", count: added)
          else
            redirect_to selections_path, alert: t(".bulk_partial", count: added, failed: failed.to_sentence)
          end
        end

        def bulk_selections
          Decidim::KpiManager::Selection.where(component: current_component, id: Array(params[:ids])).to_a
        end

        # The value history is snapshotted too (the public gallery can't call
        # the API, it has no token), to be plotted in the card's chart. On a
        # refresh it's added to the one already saved, which is kept even if
        # the history can't be fetched this time.
        def snapshot(item, previous_history = [])
          history = Decidim::KpiManager::Selection.merge_history(previous_history, api_client.history(item))
          item.slice("name", "description", "value", "unit", "recorded_at", "source", "latitude", "longitude", "update_frequency", "chart_type")
              .merge("target_value" => item["target"]&.to_s, "history" => history)
        end

        def find_in_catalog(external_id, kind)
          finder = kind == "measure" ? api_client.method(:find_measure) : api_client.method(:find_kpi)
          finder.call(external_id)
        end
      end
    end
  end
end
