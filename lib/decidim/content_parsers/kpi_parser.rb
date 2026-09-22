# frozen_string_literal: true

module Decidim
  module ContentParsers
    # The `[[KPI: ...]]` tag already embeds a full KPI/measure snapshot
    # (see Decidim::KpiManager::Shortcode), so there is nothing to rewrite at
    # parse time. Declared empty, as recommended in decidim-core's
    # content_processor.rb, since only the renderer is needed.
    class KpiParser < BaseParser
    end
  end
end
