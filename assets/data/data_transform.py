import pandas as pd
import json
import os

def prepare_mountain_data(file_path, output_path):
    # Load the dataset
    df = pd.read_csv(file_path)

    # Handle potential NaN values by filling with mean (for numeric) or mode (for categorical)
    numeric_cols = ['Decibel_Level', 'Green_Space_Area', 'Air_Quality_Index', 'Happiness_Score', 'Cost_of_Living_Index', 'Healthcare_Index']
    for col in numeric_cols:
        if df[col].isnull().any():
            df[col].fillna(df[col].mean(), inplace=True)
    
    if df['Traffic_Density'].isnull().any():
        df['Traffic_Density'].fillna(df['Traffic_Density'].mode()[0], inplace=True)

    # Convert Traffic_Density to numerical values for processing
    traffic_map = {'Low': 0.1, 'Medium': 0.4, 'High': 0.7, 'Very High': 1.0}
    df['Traffic_Weight'] = df['Traffic_Density'].map(traffic_map)
    
    # Fill any NaNs that may have resulted from the mapping
    if df['Traffic_Weight'].isnull().any():
        df['Traffic_Weight'].fillna(df['Traffic_Weight'].mean(), inplace=True)

    # Group by City to get average metrics across all months
    city_group = df.groupby('City').agg({
        'Decibel_Level': 'mean',
        'Green_Space_Area': 'mean',
        'Air_Quality_Index': 'mean',
        'Happiness_Score': 'mean',
        'Cost_of_Living_Index': 'mean',
        'Healthcare_Index': 'mean',
        'Traffic_Weight': 'mean'
    }).reset_index()

    # Using Min-Max Normalization
    cols_to_normalize = ['Decibel_Level', 'Green_Space_Area', 'Air_Quality_Index', 
                         'Happiness_Score', 'Cost_of_Living_Index', 'Healthcare_Index', 'Traffic_Weight']
    
    for col in cols_to_normalize:
        min_val = city_group[col].min()
        max_val = city_group[col].max()
        if max_val != min_val:
            city_group[f'{col}_norm'] = (city_group[col] - min_val) / (max_val - min_val)
        else:
            city_group[f'{col}_norm'] = 0.5

    # Final safety check for NaNs
    for col in cols_to_normalize:
        city_group[f'{col}_norm'].fillna(0.5, inplace=True)

    mountains = []
    for _, row in city_group.iterrows():
        mountain = {
            "city": row['City'],
            "peakHeight": row['Happiness_Score_norm'],
            "baseWidth": row['Cost_of_Living_Index_norm'],
            "roughness": row['Decibel_Level_norm'],
            "numPeaks": int(1 + (row['Traffic_Weight_norm'] * 5)),
            "snowCap": 1.0 - row['Air_Quality_Index_norm'],
            "treeDensity": row['Green_Space_Area_norm'],
            "steepness": (row['Cost_of_Living_Index_norm'] + (1 - row['Green_Space_Area_norm'])) / 2,
            "peakSharpness": row['Healthcare_Index_norm'],
            "plateauSize": (row['Happiness_Score_norm'] + row['Healthcare_Index_norm']) / 2,
            "creviceDepth": row['Traffic_Weight_norm'],
            "cloudLevel": row['Air_Quality_Index_norm'],
            "textureID": "industrial" if row['Traffic_Weight_norm'] > 0.6 else "natural",
            "glow": (row['Happiness_Score_norm'] + row['Decibel_Level_norm']) / 2,
            
            # Original Data Mapping
            "originalData": {
                "Decibel Level": round(row['Decibel_Level'], 2),
                "Traffic Density": "Low" if row['Traffic_Weight'] <= 0.25 else "Medium" if row['Traffic_Weight'] <= 0.55 else "High" if row['Traffic_Weight'] <= 0.85 else "Very High",
                "Green Space Area (%)": round(row['Green_Space_Area'], 2),
                "Air Quality Index": round(row['Air_Quality_Index'], 2),
                "Happiness Score": round(row['Happiness_Score'], 2),
                "Cost of Living Index": round(row['Cost_of_Living_Index'], 2),
                "Healthcare Index": round(row['Healthcare_Index'], 2)
            }
        }
        mountains.append(mountain)

    # Save to JSON for the web app
    with open(output_path, 'w') as f:
        json.dump(mountains, f, indent=4)
    
    # Also save a copy to public/assets/data/ for the web app to use
    public_output_path = os.path.join(os.path.dirname(os.path.dirname(script_dir)), 'public', 'assets', 'data', 'mountains_data.json')
    os.makedirs(os.path.dirname(public_output_path), exist_ok=True)
    with open(public_output_path, 'w') as f:
        json.dump(mountains, f, indent=4)
        
    print(f"Success: '{os.path.basename(output_path)}' created and copied to public/assets/data/.")

# Get the absolute path of the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define the input and output file paths relative to the script's location
train_csv_path = os.path.join(script_dir, 'train.csv')
output_json_path = os.path.join(script_dir, 'mountains_data.json')

# Run the data preparation
prepare_mountain_data(train_csv_path, output_json_path)
