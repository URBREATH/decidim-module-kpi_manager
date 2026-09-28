// Images
require.context("../images", true)

// The editor button is bundled in the Decidim core pack (see
// src/decidim/kpi_manager/editor_button.js), so it works in public and admin forms.

// Card expand behaviour for the public gallery (see selections/index.html.erb)
import "src/decidim/kpi_manager/card_expand";

// Small map preview for geolocated KPIs (see selections/index.html.erb)
import "src/decidim/kpi_manager/map_preview";
