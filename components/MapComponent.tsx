import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function MapComponent({ location, orders, acceptedIds, selectedOrder, onSelectOrder, routeCoordinates, mapRef: externalMapRef }: any) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const webViewRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const s = useMemo(() => getStyles(isDark), [isDark]);

  const injectedHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background: #FAFAFA; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        }
        #map { 
          height: 100vh; 
          width: 100vw; 
          background: #FAFAFA; 
        }
        .leaflet-tile-pane { 
          filter: grayscale(100%) brightness(105%) contrast(92%); 
          transition: opacity 0.3s; 
        }
        
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }

        @keyframes pro-ripple {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        @keyframes pulse-demand {
          0% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.08; }
          100% { transform: scale(1); opacity: 0.25; }
        }

        .pro-marker-container {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pro-radar-ring {
          position: absolute;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(245, 158, 11, 0.25);
          animation: pro-ripple 2.4s infinite ease-out;
        }

        .pro-marker-inner {
          position: relative;
          background: #F59E0B;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2.5px solid #FFFFFF;
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
          z-index: 2;
        }

        .custom-marker { 
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
          cursor: pointer !important;
          pointer-events: auto !important;
        }
        .custom-marker:hover {
          transform: scale(1.18);
        }

        .marker-bubble {
          width: 36px;
          height: 36px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
          border: 2.5px solid #FFFFFF;
          position: relative;
          cursor: pointer !important;
        }

        .demand-circle, .leaflet-interactive.demand-circle {
          background: rgba(245, 158, 11, 0.04);
          border: 1.5px solid rgba(245, 158, 11, 0.2);
          border-radius: 50%;
          animation: pulse-demand 4s infinite ease-in-out;
          pointer-events: none !important;
        }

        .modern-tooltip {
          background: #FFFFFF !important;
          color: #0F172A !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
          padding: 10px 14px !important;
          pointer-events: none !important;
        }
        .modern-tooltip::before { display: none !important; }
        .leaflet-control-attribution, .leaflet-bottom.leaflet-right, .leaflet-control-container .leaflet-bottom { 
          display: none !important; 
          opacity: 0 !important; 
          visibility: hidden !important; 
          pointer-events: none !important; 
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false, 
          attributionControl: false,
          fadeAnimation: true, 
          markerZoomAnimation: true,
          preferCanvas: true
        }).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '',
          subdomains: ['a', 'b', 'c'],
          updateWhenIdle: true,
          keepBuffer: 3
        }).addTo(map);

        var circlesLayer = L.layerGroup().addTo(map);
        var routeCasingLayer = L.polyline([], { 
          color: '#F59E0B', 
          weight: 7, 
          opacity: 0.95, 
          lineJoin: 'round', 
          lineCap: 'round'
        }).addTo(map);
        var routeCoreLayer = L.polyline([], { 
          color: '#FFFFFF', 
          weight: 2.5, 
          opacity: 0.85, 
          lineJoin: 'round', 
          lineCap: 'round'
        }).addTo(map);
        var markersLayer = L.layerGroup().addTo(map);
        var proMarker = null;

        function updateProLocation(lat, lng) {
          if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
          var iconHtml = '<div class="pro-marker-container">' +
            '<div class="pro-radar-ring"></div>' +
            '<div class="pro-marker-inner" title="Prestador (Você)">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/>' +
                '<path d="M10 10V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5"/>' +
                '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/>' +
              '</svg>' +
            '</div>' +
          '</div>';
          var icon = L.divIcon({ html: iconHtml, className: 'pro-marker', iconSize: [44, 44], iconAnchor: [22, 22] });
          if (!proMarker) {
            proMarker = L.marker([lat, lng], {icon: icon, zIndexOffset: 500}).addTo(map);
          } else {
            proMarker.setLatLng([lat, lng]);
          }
        }

        function updateMarkers(ordersData, acceptedIds, selectedId, userId, proLat, proLng) {
          markersLayer.clearLayers();
          circlesLayer.clearLayers();
          
          var safeOrders = Array.isArray(ordersData) ? ordersData : [];
          var safeAccepted = Array.isArray(acceptedIds) ? acceptedIds : [];

          // Group orders by coordinate to detect overlapping
          var coordsMap = {};
          safeOrders.forEach(function(o) {
            if (!o || !o.latitude || !o.longitude) return;
            var latNum = Number(o.latitude);
            var lngNum = Number(o.longitude);
            if (isNaN(latNum) || isNaN(lngNum)) return;

            // Group using 5 decimal places (approx. 1 meter precision)
            var key = latNum.toFixed(5) + ',' + lngNum.toFixed(5);
            if (!coordsMap[key]) {
              coordsMap[key] = [];
            }
            coordsMap[key].push(o);
          });
          
          // Render each group, distributing overlapping markers in a small circle
          Object.keys(coordsMap).forEach(function(key) {
            var group = coordsMap[key];
            var count = group.length;
            
            group.forEach(function(o, idx) {
              var latNum = Number(o.latitude);
              var lngNum = Number(o.longitude);
              var lat = latNum;
              var lng = lngNum;
              
              if (count > 1) {
                // Distribute in a small, neat circle (approx. 18 meters radius)
                var radius = 0.00018; 
                var angle = (2 * Math.PI * idx) / count;
                lat = latNum + radius * Math.cos(angle);
                lng = lngNum + (radius * Math.sin(angle)) / Math.cos(latNum * Math.PI / 180);
              }
              
              var isMine = safeAccepted.includes(o.id);
              var isAvailable = !isMine && !['accepted', 'in_progress'].includes(o.status);
              
              var color = isMine ? '#10B981' : '#F59E0B';
              var statusLabel = isMine ? (o.status === 'in_progress' ? 'EM ANDAMENTO' : 'SEU PEDIDO') : (['accepted', 'in_progress'].includes(o.status) ? 'EM ATENDIMENTO' : 'DISPONÍVEL');
              
              // Demand Circle for available orders (non-interactive so it never blocks clicks)
              if (isAvailable) {
                L.circle([lat, lng], {
                  radius: 140,
                  color: '#F59E0B',
                  fillColor: '#F59E0B',
                  fillOpacity: 0.06,
                  weight: 1,
                  interactive: false,
                  className: 'demand-circle'
                }).addTo(circlesLayer);
              }

              // Ícone de mão de ajuda para o pedido do cliente (ou check para aceito)
              var iconSvg = isMine 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14"/><path d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.8L13 11"/><path d="m2 10 6 6"/></svg>';

              var helpersCount = (o.request_helpers && Array.isArray(o.request_helpers)) ? o.request_helpers.length : 0;
              var badgeHtml = helpersCount > 0 ? '<div style="position:absolute;top:-6px;right:-6px;background:#EF4444;color:white;width:17px;height:17px;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;border:2px solid white;font-weight:bold;">' + helpersCount + '</div>' : '';

              var iconHtml = '<div class="marker-bubble" style="background:'+color+';">' +
                iconSvg +
                badgeHtml +
              '</div>';
              
              var icon = L.divIcon({ html: iconHtml, className: 'custom-marker', iconSize: [36, 36], iconAnchor: [18, 18] });
              
              // Set marker at the coordinate with high z-index and explicit click event
              var m = L.marker([lat, lng], {
                icon: icon, 
                riseOnHover: true,
                zIndexOffset: (selectedId === o.id) ? 3000 : (isMine ? 2000 : 1000)
              }).on('click', function(e) {
                if (e && e.originalEvent) {
                  e.originalEvent.stopPropagation();
                }
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({type: 'SELECT_ORDER', id: o.id}));
                }
              }).addTo(markersLayer);

              if (selectedId === o.id) {
                var desc = o.description ? (o.description.length > 50 ? o.description.substring(0, 47) + '...' : o.description) : 'Sem descrição';
                var helpersText = helpersCount > 0 ? ' <span style="font-weight:normal;opacity:0.7">(' + helpersCount + ' interessados)</span>' : '';
                
                var distanceHtml = '';
                // Keep the distance calculation and route accurate using the original order coordinates
                if (proLat && proLng && o.latitude && o.longitude) {
                  var d = Math.sqrt(Math.pow(latNum - proLat, 2) + Math.pow(lngNum - proLng, 2)) * 111;
                  var mins = Math.round((d / 35) * 60) + 3;
                  distanceHtml = '<div style="font-size:12px;color:#64748B;margin-top:6px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + d.toFixed(1) + 'km • aprox. ' + mins + 'min</div>';
                }

                var priceTag = o.price > 0 ? '<div style="background:#FEF3C7;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;color:#D97706;border:1px solid #FDE68A;">R$ ' + o.price + '</div>' : '';

                var tooltipHtml = '<div style="min-width:180px;">' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
                    '<div style="font-weight:800;color:#0F172A;font-size:14px;">' + (o.category || 'Serviço') + '</div>' +
                    priceTag +
                  '</div>' +
                  '<div style="font-size:12.5px;color:#475569;line-height:1.4;margin-bottom:8px;">"' + desc + '"</div>' +
                  '<div style="font-weight:700;color:' + color + ';font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:4px;">● ' + statusLabel + helpersText + '</div>' + 
                  distanceHtml + 
                '</div>';
                m.bindTooltip(tooltipHtml, { permanent: true, direction: 'top', className: 'modern-tooltip' }).openTooltip();
              }
            });
          });
        }

        function updateRoute(points, color) {
          if (routeCasingLayer && routeCoreLayer) {
            routeCasingLayer.setLatLngs(points || []);
            routeCasingLayer.setStyle({ color: color || '#F59E0B' });
            routeCoreLayer.setLatLngs(points || []);
            if (points && points.length > 0 && !window.isNavModeActive) {
              try {
                routeCasingLayer.bringToFront();
                routeCoreLayer.bringToFront();
                map.fitBounds(routeCasingLayer.getBounds().pad(0.25), { animate: true });
              } catch(e) {}
            }
          }
        }

        window.addEventListener('message', function(e) {
          try {
            var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (!data) return;
            if (data.type === 'RECENTER') map.setView([data.lat, data.lng], 15);
            if (data.type === 'SET_NAV_MODE') {
              window.isNavModeActive = !!data.active;
              if (data.active) {
                if (data.proLat && data.proLng) {
                  var targetLat = data.targetLat ? Number(data.targetLat) : data.proLat;
                  var targetLng = data.targetLng ? Number(data.targetLng) : data.proLng;
                  var dLat = targetLat - data.proLat;
                  var dLng = targetLng - data.proLng;
                  var len = Math.sqrt(dLat*dLat + dLng*dLng) || 1;
                  var centerLat = data.proLat + (dLat / len) * 0.0004;
                  var centerLng = data.proLng + (dLng / len) * 0.0004;
                  map.setView([centerLat, centerLng], 18, { animate: true, duration: 0.6 });
                }
              } else {
                if (data.proLat && data.proLng) {
                  map.setView([data.proLat, data.proLng], 15, { animate: true });
                }
              }
            }
            if (data.type === 'UPDATE_DATA') {
              if (map.getZoom() <= 2 && data.proLat && data.proLng) {
                map.setView([data.proLat, data.proLng], 15);
              }
              if (data.proLat && data.proLng) {
                updateProLocation(data.proLat, data.proLng);
                if (window.isNavModeActive) {
                  var sel = (data.orders || []).find(function(o){ return o.id === data.selectedId; });
                  var targetLat = sel?.latitude ? Number(sel.latitude) : data.proLat;
                  var targetLng = sel?.longitude ? Number(sel.longitude) : data.proLng;
                  var dLat = targetLat - data.proLat;
                  var dLng = targetLng - data.proLng;
                  var len = Math.sqrt(dLat*dLat + dLng*dLng) || 1;
                  var centerLat = data.proLat + (dLat / len) * 0.0004;
                  var centerLng = data.proLng + (dLng / len) * 0.0004;
                  map.panTo([centerLat, centerLng], { animate: true, duration: 0.3 });
                }
              }
              updateMarkers(data.orders || [], data.acceptedIds || [], data.selectedId, data.userId, data.proLat, data.proLng);
              updateRoute(data.route || [], data.routeColor || '#F59E0B');
            }
          } catch(err) {}
        });
        
        // Avisa que o mapa está pronto — aguarda a ponte estar disponível
        function notifyReady() {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'READY'}));
            } else {
              setTimeout(notifyReady, 100);
            }
          } catch(e) {
            setTimeout(notifyReady, 100);
          }
        }
        // Aguarda o mapa renderizar antes de avisar
        map.whenReady(function() {
          setTimeout(notifyReady, 200);
        });
      </script>
    </body>
    </html>
  `, [isDark]);

  console.log('[MapComponent] HTML Gerado com sucesso!');
  // Adiciona verificação para encontrar 'isDark' no HTML gerado
  if (injectedHtml.includes('isDark')) {
    console.error('[MapComponent] ERRO CRÍTICO: "isDark" literal vazado no HTML!', injectedHtml.split('\\n').filter(l => l.includes('isDark')));
  } else {
    console.log('[MapComponent] HTML Gerado com sucesso! Nenhuma ocorrência literal de isDark foi encontrada. Isso é o que a WebView recebe:', injectedHtml.substring(0, 100));
  }

  // Envia atualizações via injeção de JS (Ultra Rápido)
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    const proLat = location?.coords?.latitude || -23.2641;
    const proLng = location?.coords?.longitude || -47.2991;
    const userId = user?.id;
    const acceptedIdsArray = Array.from(acceptedIds || []);
    
    const selectedIsMine = acceptedIds && acceptedIds.has(selectedOrder?.id);
    const routeColor = selectedIsMine ? '#10B981' : '#0284C7';
    
    let routePoints = routeCoordinates?.map((c: any) => [c.latitude, c.longitude]) || [];
    if (routePoints.length === 0 && selectedOrder && selectedOrder.latitude && selectedOrder.longitude) {
      const destLat = Number(selectedOrder.latitude);
      const destLng = Number(selectedOrder.longitude);
      if (!isNaN(destLat) && !isNaN(destLng)) {
        routePoints = [[proLat, proLng], [destLat, destLng]];
      }
    }

    const data = {
      type: 'UPDATE_DATA',
      proLat, proLng,
      orders: orders || [],
      acceptedIds: acceptedIdsArray,
      selectedId: selectedOrder?.id,
      userId,
      route: routePoints,
      routeColor
    };

    const cmd = `window.postMessage(${JSON.stringify(data)}, '*'); true;`;
    webViewRef.current.injectJavaScript(cmd);
  }, [location, orders, acceptedIds, selectedOrder, routeCoordinates, isMapReady]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'READY') setIsMapReady(true);
      if (data.type === 'SELECT_ORDER') {
        const order = orders?.find((o: any) => o.id === data.id);
        if (order) onSelectOrder(order);
      }
    } catch (e) {}
  };

  if (externalMapRef) {
    externalMapRef.current = {
      animateToRegion: (region: any) => {
        const cmd = `window.postMessage(JSON.stringify({type: 'RECENTER', lat: ${region.latitude}, lng: ${region.longitude}}), '*'); true;`;
        webViewRef.current?.injectJavaScript(cmd);
      }
    };
  }

  return (
    <View style={s.container}>
      <WebView
        ref={webViewRef}
        source={{ html: injectedHtml }}
        onMessage={handleMessage}
        style={s.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        originWhitelist={['*']}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        geolocationEnabled={true}
        onLoad={() => {
          // Fallback: se o READY não chegou em 3s, força isMapReady
          setTimeout(() => setIsMapReady(prev => prev ? prev : true), 3000);
        }}
        onError={(e) => console.warn('[MapWebView] Error:', e.nativeEvent)}
        onHttpError={(e) => console.warn('[MapWebView] HTTP Error:', e.nativeEvent.statusCode)}
      />
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  map: { flex: 1, width: '100%' }
});
