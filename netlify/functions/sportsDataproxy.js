{
  "version": "3.6.1",
  "description": "Unified Parlay Configuration – NFL Engine Integration with ATD-only Global Parlay Support and Roster Freshness Hooks (Jan 2026)",

  "defaults": {
    "min_confidence": 0.58,
    "min_grade": "B-",
    "max_legs": 10,
    "leg_counts": [3, 5, 7, 10],
    "include_cross_sport": true,
    "cross_sport_limit": 3,
    "include_atd_in_parlays": true,
    "include_props_in_parlays": true,
    "include_atd_only_global": true,
    "force_unique_games": true,
    "avoid_high_correlation": true,
    "max_same_team_legs": 2,
    "grade_priority": ["A+", "A", "A-", "B+", "B", "B-"],
    "confidence_weight": 0.6,
    "edge_weight": 0.4,
    "rounding_precision": 2,
    "parlay_grade_threshold": "B-",
    "market_priority_order": ["prop", "atd", "spread", "total", "moneyline"],
    "include_odds": true,
    "include_start_time": true,
    "output_format": "mobile_friendly",
    "auto_refresh_roster": true,
    "roster_max_age_hours": 12
  },

  "modes": {
    "single_game": {
      "enabled": true,
      "leg_counts": [3, 5, 7],
      "allow_props": true,
      "allow_atd": true,
      "allow_cross_team_mix": false,
      "selection_strategy": "confidence_then_edge",
      "grade_cutoff": "B-"
    },

    "cross_sport": {
      "enabled": true,
      "leg_counts": [3, 5, 7],
      "max_per_run": 3,
      "selection_strategy": "highest_combined_score",
      "include_props": true,
      "include_atd": true,
      "include_top_games_only": true,
      "max_games": 5,
      "min_confidence": 0.6,
      "min_grade": "B"
    },

    "global_atd_only": {
      "enabled": true,
      "leg_counts": [3, 5, 7],
      "selection_strategy": "highest_td_probability",
      "description": "Builds global 3/5/7-leg parlays using only highest-confidence anytime TD scorers across all games.",
      "include_props": false,
      "include_atd": true,
      "confidence_threshold": 0.70,
      "grade_cutoff": "B-"
    },

    "gpp_mode": {
      "enabled": true,
      "bias": "ceiling",
      "min_confidence": 0.55,
      "variance_tolerance": "high",
      "include_props": true
    },

    "cash_mode": {
      "enabled": true,
      "bias": "floor",
      "min_confidence": 0.65,
      "variance_tolerance": "low",
      "include_props": false
    }
  },

  "build_rules": {
    "leg_scoring_formula": "(confidence * 0.6) + (edge * 0.4)",
    "exclude_if_conflict": true,
    "avoid_opposite_legs": true,
    "avoid_duplicate_markets": true,
    "avoid_high_variance_props": true,
    "allow_same_game_mix_for_props": true,
    "allow_atd_plus_team_leg": true,
    "prefer_overs_for_parlays": true,
    "use_confidence_sorting": true,
    "apply_volatility_dampening": true
  },

  "output_rules": {
    "include_confidence": true,
    "include_edge": true,
    "include_grade": true,
    "include_odds": true,
    "show_expected_value": true,
    "show_combined_confidence": true,
    "display_mode": "mobile_friendly",
    "include_game_info": true,
    "show_start_times": true,
    "show_team_context": true,
    "expanded_spacing": true
  },

  "summary": {
    "include_summary": true,
    "sort_by": "confidence",
    "include_top_parlays": 3,
    "include_best_single_game_parlays": true,
    "include_best_cross_sport_parlays": true,
    "include_global_atd_parlays": true,
    "show_average_confidence": true,
    "show_average_edge": true,
    "only_show_global_summary_if_multiple_games": true
  }
}
