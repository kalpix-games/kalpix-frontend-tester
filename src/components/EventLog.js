import React, { useEffect, useRef } from "react";

/**
 * Event Log Component
 * Displays scrollable log of game events with color coding
 */
function EventLog({ events, onClear }) {
	const logEndRef = useRef(null);

	// 🔧 DISABLED: Auto-scroll removed per user request
	// Users can manually scroll to see events
	// useEffect(() => {
	// 	if (logEndRef.current) {
	// 		logEndRef.current.scrollIntoView({ behavior: "smooth" });
	// 	}
	// }, [events]);

	const getEventStyle = (type) => {
		const styles = {
			success: {
				backgroundColor: "#d4edda",
				color: "#155724",
				borderLeft: "4px solid #28a745",
			},
			error: {
				backgroundColor: "#f8d7da",
				color: "#721c24",
				borderLeft: "4px solid #dc3545",
			},
			info: {
				backgroundColor: "#d1ecf1",
				color: "#0c5460",
				borderLeft: "4px solid #17a2b8",
			},
			warning: {
				backgroundColor: "#fff3cd",
				color: "#856404",
				borderLeft: "4px solid #ffc107",
			},
			default: {
				backgroundColor: "#f8f9fa",
				color: "#495057",
				borderLeft: "4px solid #6c757d",
			},
		};
		return styles[type] || styles.default;
	};

	const getEventIcon = (type) => {
		const icons = {
			success: "✅",
			error: "❌",
			info: "ℹ️",
			warning: "⚠️",
			default: "📝",
		};
		return icons[type] || icons.default;
	};

	return (
		<div
			className="section"
			style={{ height: "600px", display: "flex", flexDirection: "column" }}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "15px",
				}}
			>
				<h2 style={{ margin: 0 }}>📋 Event Log</h2>
				<button
					onClick={onClear}
					style={{
						padding: "6px 12px",
						fontSize: "12px",
						backgroundColor: "#6c757d",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					🧹 Clear
				</button>
			</div>

			{/* Event Count */}
			<div
				style={{
					padding: "8px",
					backgroundColor: "#e9ecef",
					borderRadius: "4px",
					marginBottom: "10px",
					fontSize: "12px",
					textAlign: "center",
				}}
			>
				<strong>Total Events:</strong> {events.length}
			</div>

			{/* Scrollable Log */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					border: "1px solid #dee2e6",
					borderRadius: "6px",
					padding: "10px",
					backgroundColor: "#fff",
				}}
			>
				{events.length === 0 ? (
					<div
						style={{ textAlign: "center", color: "#6c757d", padding: "20px" }}
					>
						No events yet. Start playing to see events here.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						{events.map((event) => (
							<div
								key={event.id || `${event.timestamp}-${event.event}`}
								style={{
									...getEventStyle(event.type),
									padding: "10px",
									borderRadius: "4px",
									fontSize: "13px",
									fontFamily: "monospace",
								}}
							>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										marginBottom: "4px",
									}}
								>
									<span style={{ fontWeight: "bold" }}>
										{getEventIcon(event.type)} {event.event || "Event"}
									</span>
									<span style={{ fontSize: "11px", opacity: 0.8 }}>
										{new Date(event.timestamp).toLocaleTimeString()}
									</span>
								</div>
								<div style={{ fontSize: "12px" }}>{event.message}</div>
								{event.details && (
									<div
										style={{
											marginTop: "6px",
											padding: "6px",
											backgroundColor: "rgba(0,0,0,0.05)",
											borderRadius: "3px",
											fontSize: "11px",
											fontFamily: "monospace",
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
										}}
									>
										{typeof event.details === "string"
											? event.details
											: JSON.stringify(event.details, null, 2)}
									</div>
								)}
							</div>
						))}
						<div ref={logEndRef} />
					</div>
				)}
			</div>

			{/* Export Button */}
			<button
				onClick={() => {
					const dataStr = JSON.stringify(events, null, 2);
					const dataBlob = new Blob([dataStr], { type: "application/json" });
					const url = URL.createObjectURL(dataBlob);
					const link = document.createElement("a");
					link.href = url;
					link.download = `uno-events-${Date.now()}.json`;
					link.click();
					URL.revokeObjectURL(url);
				}}
				disabled={events.length === 0}
				style={{
					marginTop: "10px",
					padding: "8px",
					fontSize: "12px",
					backgroundColor: "#17a2b8",
					color: "white",
					border: "none",
					borderRadius: "4px",
					cursor: events.length === 0 ? "not-allowed" : "pointer",
					opacity: events.length === 0 ? 0.6 : 1,
				}}
			>
				💾 Export Events (JSON)
			</button>
		</div>
	);
}

export default EventLog;
