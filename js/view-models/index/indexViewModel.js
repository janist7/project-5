var indexViewModel = {

    init: function () {
        "use strict";
        /*global google */
        /*global styles*/
        /*global ko*/
        var map;
        var drawingManager;
        var zoomAutocomplete;
        var largeInfowindow;
        var polygon = null;
        var options = {
            types: ['geocode'],
            componentRestrictions: {
                country: "lv"
            }
        };
        var clientId = "ADD231Y2455M2GT0IBKL53WH2B52VDF3EJDT0FCLLOGAC5I4";
        var client_secret = "FGT1TFGQSEAO3DU3ISGF50GDWASJAM5BF50AE1G5AVBT5R4U";
        var version = "20171030";
        /* Initialize google map. */
        map = new google.maps.Map(document.getElementById('map'), {
            center: {
                lat: 56.948005,
                lng: 24.099069
            },
            zoom: 12,
            styles: styles,
            mapTypeId: 'roadmap',
            mapTypeControl: false,
            streetViewControl: false,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.TOP_RIGHT
            }
        });

        /* Initialize infowindow. */
        largeInfowindow = new google.maps.InfoWindow({
            maxWidth: 200
        });

        /* Initialize zoom autocomplete. */
        zoomAutocomplete = new google.maps.places.Autocomplete(
            document.getElementById('zoom-to-area-text'),
            options
        );

        /* Initialize the drawing manager. */
        drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: google.maps.drawing.OverlayType.POLYGON,
            drawingControl: true,
            drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
                drawingModes: [google.maps.drawing.OverlayType.POLYGON]
            }
        });

        ko.applyBindings(new indexViewModel.render(
            map, drawingManager, zoomAutocomplete,
            largeInfowindow, polygon, options,
            clientId, client_secret, version
        ));
    }, // init


    render: function (map, drawingManager, zoomAutocomplete, largeInfowindow, polygon, options, clientId, client_secret, version) {
        "use strict";
        var self = this;
        /*global $*/
        /*global model*/

        /* Observables */
        self.markers = ko.observableArray();
        self.address = ko.observable('');
        self.visibleMarkers = ko.observableArray();
        self.phzoom = ko.observable('Zoom to location');
        self.phfilter = ko.observable('Search place');
        self.userInput = ko.observable('');
        // Observables


        /* Marker object */
        self.Marker = function (dataObj) {
            this.title = dataObj.name;
            this.latLng = dataObj.latLng;
            this.pin = null;
            this.id = dataObj.id;
            this.forsquareDataAvailable = false;
            this.formattedAddress = [];
            this.forsquareLink = ('-');
            this.forsquareImageLink = '-';
            this.forsquareRating = '-';
            this.hours = '-';
        };


        /* Create all markers from marker object */
        model.locations.forEach(function (marker) {
            self.markers.push(new self.Marker(marker));
        });


        /* Create costom marker pin from passed color */
        self.makeMarkerIcon = function (markerColor) {
            var markerImage = new google.maps.MarkerImage(
                'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor + '|40|_|%E2%80%A2',
                new google.maps.Size(21, 34),
                new google.maps.Point(0, 0),
                new google.maps.Point(10, 34),
                new google.maps.Size(21, 34)
            );
            return markerImage;
        };


        var defaultIcon = self.makeMarkerIcon('0091ff');
        var highlightedIcon = self.makeMarkerIcon('FFFF24');


        /* This function will loop through the markers array and display them all and add them initially to visible markers array */
        self.showMarkers = function () {
            var bounds = new google.maps.LatLngBounds();
            self.markers().forEach(function (marker) {
                marker.pin.setVisible(true);
                marker.pin.setMap(map);
                // Dont readd visible markers at each press of showMarkers
                if (!polygon) {
                    if (ko.unwrap(self.visibleMarkers).indexOf(marker) === -1) {
                        self.visibleMarkers.push(marker);
                    }
                }
                bounds.extend(marker.pin.position);
            });
            if (polygon) {
                self.searchWithinPolygon(polygon);
            }
            map.fitBounds(bounds);
        };


        /* This function will loop through the markers and hide them all and remove them from visible markers array. */
        self.hideMarkers = function () {
            self.visibleMarkers.removeAll();
            self.markers().forEach(function (marker) {
                marker.pin.setMap(null);
            });
        };


        /* The following group uses the markers array to create an array of markers on initialize and gets information from forsquare.*/
        self.markers().forEach(function (marker) {
            var url = "https://api.foursquare.com/v2/venues/" + marker.id + "?client_id=" + clientId + "&client_secret=" + client_secret + "&v=" + version;
            var markerOptions = {
                title: marker.title,
                map: self.googleMap,
                position: marker.latLng,
                animation: google.maps.Animation.DROP,
                icon: defaultIcon
            };
            // Ajax call to fill out rest of infoview info
            $.ajax({
                url: url,
                dataType: "json",
                async: true,
                success: function (data) {
                    var result = data.response.venue;
                    if (result.location) {
                        marker.formattedAddress = result.location.hasOwnProperty('formattedAddress') ? result.location.formattedAddress : "-";
                    }
                    if (result.canonicalUrl) {
                        marker.forsquareLink = result.canonicalUrl;
                    }
                    if (result.bestPhoto) {
                        marker.forsquareImageLink = result.bestPhoto.prefix + "100x100" + result.bestPhoto.suffix;
                    }
                    if (result.rating) {
                        marker.forsquareRating = result.rating;
                    }
                    if (result.hours) {
                        marker.hours = result.hours.hasOwnProperty('status') ? result.hours.status : "-";
                    }
                    marker.forsquareDataAvailable = true;
                },
                error: function (e) {
                    // if there is a error content string contains only a warning
                    marker.forsquareDataAvailable = false;
                }
            });
            marker.pin = new google.maps.Marker(markerOptions);
            marker.pin.addListener('click', function () {
                self.populateInfoWindow(marker, largeInfowindow);
            });
            marker.pin.addListener('mouseover', function () {
                this.setIcon(highlightedIcon);
            });
            marker.pin.addListener('mouseout', function () {
                this.setIcon(defaultIcon);
            });
        });
        // Initial run of showMarkers
        self.showMarkers();


        /* Zooms to location based on address given, needs to unwrap the observable first before the value can be used */
        self.zoomToArea = function () {
            var geocoder = new google.maps.Geocoder();
            if (ko.utils.unwrapObservable(self.address) === '') {
                window.alert('You must enter an area, or address.');
            } else {
                geocoder.geocode({
                    address: ko.utils.unwrapObservable(self.address),
                    componentRestrictions: {
                        locality: 'Latvia'
                    }
                }, function (results, status) {
                    if (status === google.maps.GeocoderStatus.OK) {
                        map.setCenter(results[0].geometry.location);
                        map.setZoom(16);
                    } else {
                        window.alert('We could not find that location - try entering a more' +
                            ' specific place.');
                    }
                });
            }
        };


        /* This function populates the infowindow when the pin is clicked. */
        self.populateInfoWindow = function (marker, infowindow) {
            if (infowindow.marker !== marker.pin) {
                infowindow.setContent('');
                infowindow.marker = marker.pin;
                marker.pin.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(function () {
                    marker.pin.setAnimation(null);
                }, 1420); // 1420 seems to be 2 bounces
                infowindow.addListener('closeclick', function () {
                    infowindow.marker = null;
                });
                var streetViewService = new google.maps.StreetViewService();
                var radius = 50;
                var contentString;
                if (marker.forsquareDataAvailable) {
                    contentString = '<h4>' + marker.title + '</h4>' +
                        '<hr>' + '<div class="forsquare">' +
                        '<img src=' + marker.forsquareImageLink + ' alt="Forsquare image"></img>' +
                        '<p> Address: ' +
                        marker.formattedAddress[0] + ", " +
                        marker.formattedAddress[1] + ", " +
                        marker.formattedAddress[2] + '</p>' +
                        '<p>' + marker.hours + '</p>' +
                        '<p> User rating: ' + marker.forsquareRating + '</p>' +
                        '<a href="' + marker.forsquareLink + '">Page on forsquare</a>' +
                        '</div>' +
                        '<hr>';
                } else {
                    contentString = '<h4>' + marker.title + '</h4>' +
                        '<hr>' +
                        '<h5>Forsquare data not available. Refresh page later.</h5>' +
                        '<hr>';
                }
                var getStreetView = function (data, status) {
                    var panorama;
                    var panoramaOptions;
                    // Adds pano div to content string depending on streetview call status
                    if (status === google.maps.StreetViewStatus.OK) {
                        contentString += '<div id="pano"></div>';
                        var nearStreetViewLocation = data.location.latLng;
                        var heading = google.maps.geometry.spherical.computeHeading(
                            nearStreetViewLocation,
                            marker.pin.position
                        );
                        panoramaOptions = {
                            position: nearStreetViewLocation,
                            pov: {
                                heading: heading,
                                pitch: 30
                            }
                        };
                        panorama = true;
                    } else {
                        contentString += '<h5>No google streets view available</h5>';
                        panorama = false;
                    }
                    infowindow.setContent(contentString);
                    if (panorama) {
                        panorama = new google.maps.StreetViewPanorama(
                            document.getElementById('pano'),
                            panoramaOptions
                        );
                    }
                };
                infowindow.setContent(contentString);
                streetViewService.getPanoramaByLocation(marker.pin.position, radius, getStreetView);
                infowindow.open(map, marker.pin);
            }
        };


        /* Event for when a marker is clicked*/
        self.showInfoWindow = function (marker) {
            google.maps.event.trigger(marker.pin, 'click');
        };


        // This toggles the poligon drawing option.
        self.toggleDrawing = function () {
            if (drawingManager.map) {
                drawingManager.setMap(null);
                if (polygon !== null) {
                    polygon.setMap(null);
                    polygon = null;
                }
                // repopulate both markers and filter list
                self.showMarkers();
                self.filterMarkers();
            } else {
                drawingManager.setMap(map);
            }
        };


        /* Add an event listener so that the polygon is captured,  call the
        searchWithinPolygon function. This will show the markers in the polygon,
        and hide any outside of it. */
        drawingManager.addListener('overlaycomplete', function (event) {
            if (polygon) {
                polygon.setMap(null);
                self.hideMarkers();
            }
            drawingManager.setDrawingMode(null);
            polygon = event.overlay;
            polygon.setEditable(true);
            self.searchWithinPolygon(polygon);
            polygon.getPath().addListener('set_at', self.searchWithinPolygon);
            polygon.getPath().addListener('insert_at', self.searchWithinPolygon);
        });


        /* This function hides all markers outside the polygon,
        and shows only the ones within it. This is so that the
        user can specify an exact area of search. */
        self.searchWithinPolygon = function () {
            self.visibleMarkers.removeAll();
            self.markers().forEach(function (marker) {
                if (google.maps.geometry.poly.containsLocation(marker.pin.position, polygon)) {
                    // Reset pin and filter list entry to visible
                    marker.pin.setMap(map);
                    self.visibleMarkers.push(marker);
                    marker.pin.setVisible(true);
                } else {
                    marker.pin.setMap(null);
                }
            });
        };


        self.filterInput = function (searchInput) {
            self.visibleMarkers.removeAll();
            // input can be found within the place name.
            self.markers().forEach(function (marker) {
                marker.pin.setVisible(false);
                if (searchInput === "") {
                    self.showMarkers();
                } else if (marker.title.toLowerCase().indexOf(searchInput) !== -1 && searchInput !== "" && marker.pin.map !== null) {
                    self.visibleMarkers.push(marker);
                }
            });
            self.visibleMarkers().forEach(function (marker) {
                marker.pin.setVisible(true);
            });
        };


        /* Filters visible markers based on user input*/
        self.filterMarkers = function () {
            var searchInput = self.userInput().toLowerCase();
            // if drawing filter active only display/search in that area
            if (polygon) {
                self.searchWithinPolygon(polygon);
                self.filterInput(searchInput);
            } else {
                self.filterInput(searchInput);
            }
        };
    } // render
};
