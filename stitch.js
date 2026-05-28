const fs = require('fs');

const dashPath = 'c:/Users/archana/OneDrive/Desktop/z01 vendor/vendor_app_flutter/lib/screens/dashboard/vendor_dashboard_screen.dart';
const newWidgetsPath = 'c:/Users/archana/OneDrive/Desktop/z01 vendor/vendor_app_flutter/lib/screens/dashboard/new_widgets.dart';

let dashContent = fs.readFileSync(dashPath, 'utf8');
const newWidgetsContent = fs.readFileSync(newWidgetsPath, 'utf8');

const emptyDashIndex = dashContent.indexOf('class _EmptyDashboard extends StatelessWidget');
const profileTabIndex = dashContent.indexOf('class _ProfileTab extends StatelessWidget');

if (emptyDashIndex === -1) {
  console.error('Could not find _EmptyDashboard');
  process.exit(1);
}

if (profileTabIndex === -1) {
  console.error('Could not find _ProfileTab');
  process.exit(1);
}

const beforeStr = dashContent.substring(0, emptyDashIndex);
const afterStr = dashContent.substring(profileTabIndex);

const finalContent = beforeStr + newWidgetsContent + '\n\n' + afterStr;

fs.writeFileSync(dashPath, finalContent);
console.log('Successfully stitched new widgets!');
