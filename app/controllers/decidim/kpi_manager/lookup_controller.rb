# frozen_string_literal: true

module Decidim
  module KpiManager
    # Small cross-component endpoint used by the "Insert KPI" editor button
    # (added to every rich text editor, see editor_button.js): given the
    # participatory space the author is currently in (read from the
    # `context-current-participatory-space` meta tag), it finds that space's
    # KPI Manager component and returns its selections as JSON.
    #
    # This lives outside Decidim::KpiManager::Engine (which is mounted per
    # component instance) because it needs to be reachable from any page,
    # regardless of which component the author is currently writing in.
    class LookupController < Decidim::ApplicationController
      def index
        render json: {
          labels: I18n.t("decidim.kpi_manager.editor").transform_keys(&:to_s),
          items: selections.map { |selection| serialize(selection) }
        }
      end

      private

      def selections
        return [] unless component

        Decidim::KpiManager::Selection.where(component:).order(created_at: :desc)
      end

      def component
        @component ||= participatory_space&.components&.find do |candidate|
          candidate.manifest_name == "kpi_manager" && candidate.published?
        end
      end

      def participatory_space
        return nil if params[:participatory_space_gid].blank?

        space = GlobalID::Locator.locate(params[:participatory_space_gid])
        space if space.respond_to?(:organization) && space.organization == current_organization
      rescue ActiveRecord::RecordNotFound, URI::InvalidURIError
        nil
      end

      def serialize(selection)
        selection.to_item.merge("shortcode" => Decidim::KpiManager::Shortcode.build(selection.to_item))
      end
    end
  end
end
