/*eslint-disable*/

export const displayMap = locations => {
    mapboxgl.accessToken =
        'pk.eyJ1IjoiaS1tb2hzaW4iLCJhIjoiY2tia2FqcXBzMGw3ejJxcGdnNGdveDhsaSJ9.5-kqbtBgNMWxWYUTKwUJdA';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/i-mohsin/ckbkcb0e00mg41iqr052j0fvh',
        scrollZoom: false,
    });

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach(loc => {
        // Create marker
        const el = document.createElement('div');
        el.className = 'marker';

        // Add marker
        new mapboxgl.Marker({
                element: el,
                anchor: 'bottom',
            })
            .setLngLat(loc.coordinates)
            .addTo(map);

        // Add popup
        new mapboxgl.Popup({
                offset: 30,
            })
            .setLngLat(loc.coordinates)
            .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
            .addTo(map);

        // Extends the map bounds to include current location
        bounds.extend(loc.coordinates);
    });

    map.fitBounds(bounds, {
        padding: {
            top: 200,
            bottom: 150,
            left: 100,
            right: 100,
        },
    });
};