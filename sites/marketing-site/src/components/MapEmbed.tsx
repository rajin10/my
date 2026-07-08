"use client";
import { ExternalLink, MapPin } from "lucide-react";

interface MapEmbedProps {
	address: string;
	city: string;
	lat?: number | null;
	lng?: number | null;
	name?: string;
}

export function MapEmbed({ address, city, lat, lng, name }: MapEmbedProps) {
	const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
	const query =
		lat && lng
			? `${lat},${lng}`
			: encodeURIComponent(`${address}, ${city}, Bangladesh`);
	const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}, Bangladesh`)}`;

	return (
		<div className="rounded-xl overflow-hidden border border-line shadow-sm">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-line">
				<div className="flex items-center gap-2">
					<MapPin size={16} className="text-primary-700 shrink-0" />
					<div>
						<div className="font-sans text-sm font-semibold text-ink-900 leading-tight">
							{address}
						</div>
						<div className="font-sans text-xs text-ink-500">{city}</div>
					</div>
				</div>
				<a
					href={mapsUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-primary-700 no-underline hover:text-primary-800 shrink-0 ml-3"
				>
					Directions
					<ExternalLink size={12} />
				</a>
			</div>

			{/* Map iframe or fallback */}
			{apiKey ? (
				<iframe
					title={name ? `Map — ${name}` : "Map"}
					width="100%"
					height="280"
					loading="lazy"
					referrerPolicy="no-referrer-when-downgrade"
					src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=15`}
					className="block border-none"
				/>
			) : (
				<a
					href={mapsUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center justify-center h-[280px] bg-primary-50 no-underline hover:bg-primary-100 transition-colors group"
				>
					<div className="text-center">
						<div className="w-12 h-12 rounded-full bg-primary-100 group-hover:bg-primary-200 flex items-center justify-center mx-auto mb-3 transition-colors">
							<MapPin size={22} className="text-primary-700" />
						</div>
						<div className="font-sans text-sm font-semibold text-ink-800 mb-0.5">
							View on Google Maps
						</div>
						<div className="font-sans text-xs text-ink-500">
							{address}, {city}
						</div>
					</div>
				</a>
			)}
		</div>
	);
}
