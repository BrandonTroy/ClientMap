# ClientMap

ClientMap is a website designed for case managers at Alliance Healthcare who have a caseload of clients which are all visited on a monthly or quarterly basis.
The software allows users to select an Excel file containing all of their client data (with a few base requirements for parsing), and then visualizes all of the clients as waypoints using the Google Maps API.

Much of the client data contained in these files is secure government data, so the data doesn't go through any backend databases, but is merely transformed on the frontend into a more visually usable display.
The one exception to this is that client addresses are cached with their coordinates in the localStorage of the browser, without names or any metadata attached, merely to cut down on the number of the Google Maps Geocoding API calls.

A demo of the software can be seen here: www.brandontroy.github.io/clientmap/
