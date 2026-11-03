import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Skeleton } from "antd";
import { LoadErrorAlert } from "@/components/feedback/load-error-alert";
import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { useAsset } from "../api";
import { DetailsTabsCard } from "../components/details/details-tabs-card";
import { MetadataCard } from "../components/details/metadata-card";
import { PlaybackCard } from "../components/details/playback-card";
import { PlayerCard } from "../components/details/player-card";
import { ResolutionsCard } from "../components/details/resolutions-card";
import { TimelineCard } from "../components/details/timeline-card";
import { VideoDetailsHeader } from "../components/details/video-details-header";
import { useAssetActions } from "../hooks/use-asset-actions";
import { assetTitle } from "../lib/asset-title";

const route = getRouteApi("/_app/videos/$id");

export function VideoDetailsPage() {
  const { id } = route.useParams();
  const navigate = useNavigate();
  const actions = useAssetActions();
  const { data, isPending, isError, isRefetching, refetch } = useAsset(id);

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Loading video">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <LoadErrorAlert
        title="We couldn't load this video."
        description="It may have been deleted, or the API may be down. Check your connection and try again."
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }

  const asset = data.GetAsset;
  const target = { id: asset._id, title: assetTitle(asset.title) };

  return (
    <>
      <VideoDetailsHeader
        asset={asset}
        onReprocess={() => actions.reprocess(target)}
        onDelete={() => actions.deleteOne(target, () => void navigate({ to: "/" }))}
      />
      <TwoColumnLayout
        main={
          <>
            <PlayerCard asset={asset} />
            {/* Remount per video so the form starts from that video's saved values. */}
            <DetailsTabsCard key={asset._id} asset={asset} />
            <ResolutionsCard asset={asset} />
          </>
        }
        side={
          <>
            <PlaybackCard asset={asset} />
            <MetadataCard asset={asset} />
            <TimelineCard logs={asset.status_logs} />
          </>
        }
      />
    </>
  );
}
