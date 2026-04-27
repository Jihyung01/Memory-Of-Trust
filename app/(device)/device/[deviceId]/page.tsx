import { DevicePageClient } from "./components/DevicePageClient";

interface DevicePageProps {
  params: Promise<{
    deviceId: string;
  }>;
}

export default async function DevicePage({ params }: DevicePageProps) {
  const { deviceId } = await params;

  return <DevicePageClient deviceToken={deviceId} />;
}
