import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SocialProofSettings = {
  webinar_id: string;
  organization_id: string;
  enabled: boolean;
  product_name: string;
  start_mode: string;
  start_delay_seconds: number;
  start_seconds: number | null;
  end_seconds: number | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  position: string;
  display_seconds: number;
  animation: string;
  sound_enabled: boolean;
  notification_color: string;
  webhook_secret: string;
};

export function useSocialProof(webinarId: string) {
  return useQuery({
    queryKey: ["social-proof", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_proof_settings")
        .select("*")
        .eq("webinar_id", webinarId)
        .maybeSingle();
      if (error) throw error;
      return data as SocialProofSettings | null;
    },
  });
}

export function useSimulatedPurchases(webinarId: string) {
  return useQuery({
    queryKey: ["simulated-purchases", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulated_purchase_events")
        .select("*")
        .eq("webinar_id", webinarId)
        .order("offset_seconds", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
